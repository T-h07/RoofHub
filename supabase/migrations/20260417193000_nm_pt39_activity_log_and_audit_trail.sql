begin;

create index if not exists security_audit_events_org_metadata_created_idx
  on public.security_audit_events ((metadata ->> 'organization_id'), created_at desc);

create or replace function public.get_company_dashboard_activity_feed(
  p_organization_id uuid,
  p_viewer_user_id uuid default auth.uid(),
  p_limit integer default 24
)
returns table (
  event_id text,
  event_source text,
  event_type text,
  occurred_at timestamptz,
  actor_user_id uuid,
  actor_display_name text,
  target_id text,
  target_label text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := p_viewer_user_id;
  v_viewer_role public.organization_member_role;
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 120));
begin
  if p_organization_id is null then
    raise exception 'Organization reference is required.' using errcode = 'P0001';
  end if;

  if v_actor_id is null then
    raise exception 'Authentication is required for activity feed access.' using errcode = '42501';
  end if;

  if public.is_admin() then
    v_viewer_role := 'owner';
  else
    v_viewer_role := public.organization_active_member_role(p_organization_id, v_actor_id);
  end if;

  if v_viewer_role is null then
    raise exception 'Active company membership is required for activity feed access.' using errcode = '42501';
  end if;

  if not public.is_admin() and v_viewer_role not in ('owner', 'admin', 'manager') then
    raise exception 'Owner, admin, or manager membership is required for activity feed access.'
      using errcode = '42501';
  end if;

  return query
  with listing_events as (
    select
      lwe.id::text as event_id,
      'listing_workflow'::text as event_source,
      lwe.event_type::text as event_type,
      lwe.created_at as occurred_at,
      lwe.actor_user_id,
      actor_profile.display_name as actor_display_name,
      lwe.listing_id::text as target_id,
      coalesce(nullif(btrim(coalesce(l.title, '')), ''), 'Listing') as target_label,
      jsonb_strip_nulls(
        jsonb_build_object(
          'event_group', 'listing_workflow',
          'from_status', lwe.from_status,
          'to_status', lwe.to_status,
          'note', nullif(btrim(coalesce(lwe.note, '')), '')
        )
      ) as metadata
    from public.listing_workflow_events lwe
    join public.listings l
      on l.id = lwe.listing_id
    left join public.profiles actor_profile
      on actor_profile.id = lwe.actor_user_id
    where lwe.organization_id = p_organization_id
  ),
  scoped_audit as (
    select
      sae.id,
      sae.event_type,
      sae.created_at,
      sae.actor_user_id,
      sae.target_type,
      sae.target_id,
      sae.listing_id,
      sae.conversation_id,
      sae.from_status,
      sae.to_status,
      sae.metadata,
      case
        when (sae.metadata ->> 'organization_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (sae.metadata ->> 'organization_id')::uuid
        else null
      end as metadata_organization_id,
      case
        when (sae.metadata ->> 'target_user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (sae.metadata ->> 'target_user_id')::uuid
        when (sae.metadata ->> 'invite_target_user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (sae.metadata ->> 'invite_target_user_id')::uuid
        else null
      end as metadata_target_user_id,
      case
        when (sae.metadata ->> 'member_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (sae.metadata ->> 'member_id')::uuid
        else null
      end as metadata_member_id,
      case
        when sae.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then sae.target_id::uuid
        else null
      end as target_uuid
    from public.security_audit_events sae
    where sae.event_type in (
      'organization.invite.created',
      'organization.invite.accepted',
      'organization.invite.revoked',
      'organization.member.role_changed',
      'organization.member.suspended',
      'organization.member.reactivated',
      'organization.member.removed',
      'organization.profile.updated',
      'organization.logo.updated',
      'organization.logo.removed',
      'messaging.conversation.assigned',
      'messaging.conversation.reassigned',
      'messaging.conversation.unassigned'
    )
  ),
  audit_events as (
    select
      scoped.id::text as event_id,
      case
        when scoped.event_type like 'organization.invite.%' then 'team_audit'
        when scoped.event_type like 'organization.member.%' then 'team_audit'
        when scoped.event_type like 'organization.profile.%'
          or scoped.event_type like 'organization.logo.%' then 'organization_audit'
        when scoped.event_type like 'messaging.conversation.%' then 'messaging_routing'
        else 'organization_audit'
      end::text as event_source,
      scoped.event_type::text as event_type,
      scoped.created_at as occurred_at,
      scoped.actor_user_id,
      actor_profile.display_name as actor_display_name,
      coalesce(
        case
          when scoped.target_type in ('organization_member', 'organization_invite', 'organization', 'conversation')
            and scoped.target_id is not null
            then scoped.target_id
          else null
        end,
        scoped.listing_id::text,
        scoped.id::text
      ) as target_id,
      coalesce(
        nullif(btrim(coalesce(target_profile.display_name, '')), ''),
        nullif(btrim(coalesce(invite_target_profile.display_name, '')), ''),
        nullif(btrim(coalesce(scoped.metadata ->> 'invite_target_email', '')), ''),
        nullif(btrim(coalesce(listing_target.title, '')), ''),
        nullif(btrim(coalesce(organization_target.name, '')), ''),
        case
          when scoped.target_type = 'organization_member' then 'Team member'
          when scoped.target_type = 'organization_invite' then 'Team invite'
          when scoped.target_type = 'organization' then 'Company workspace'
          when scoped.target_type = 'conversation' then 'Conversation'
          else 'Workspace activity'
        end
      ) as target_label,
      jsonb_strip_nulls(
        jsonb_build_object(
          'event_group',
            case
              when scoped.event_type like 'organization.invite.%' then 'team_invite'
              when scoped.event_type like 'organization.member.%' then 'team_membership'
              when scoped.event_type like 'organization.profile.%'
                or scoped.event_type like 'organization.logo.%' then 'company_profile'
              when scoped.event_type like 'messaging.conversation.%' then 'messaging_routing'
              else 'organization_audit'
            end,
          'note', nullif(btrim(coalesce(scoped.metadata ->> 'note', '')), ''),
          'from_status', coalesce(scoped.from_status::text, nullif(scoped.metadata ->> 'from_status', '')),
          'to_status', coalesce(scoped.to_status::text, nullif(scoped.metadata ->> 'to_status', '')),
          'previous_role', nullif(scoped.metadata ->> 'previous_role', ''),
          'new_role', nullif(scoped.metadata ->> 'new_role', ''),
          'target_role', nullif(scoped.metadata ->> 'target_role', ''),
          'removed_role', nullif(scoped.metadata ->> 'removed_role', ''),
          'previous_status', nullif(scoped.metadata ->> 'previous_status', ''),
          'new_status', nullif(scoped.metadata ->> 'new_status', ''),
          'removed_status', nullif(scoped.metadata ->> 'removed_status', ''),
          'invite_role', coalesce(
            nullif(scoped.metadata ->> 'invite_role', ''),
            nullif(scoped.metadata ->> 'role', ''),
            nullif(scoped.metadata ->> 'membership_role', '')
          ),
          'invite_status', coalesce(
            nullif(scoped.metadata ->> 'invite_status', ''),
            case
              when scoped.event_type = 'organization.invite.created' then 'pending'
              when scoped.event_type = 'organization.invite.accepted' then 'accepted'
              when scoped.event_type = 'organization.invite.revoked' then 'revoked'
              else null
            end
          ),
          'acceptance_outcome', nullif(scoped.metadata ->> 'acceptance_outcome', ''),
          'conversation_id', scoped.conversation_id::text
        )
      ) as metadata
    from scoped_audit scoped
    left join public.profiles actor_profile
      on actor_profile.id = scoped.actor_user_id
    left join public.listings listing_target
      on listing_target.id = scoped.listing_id
    left join public.conversations conversation_target
      on conversation_target.id = scoped.conversation_id
    left join public.listings conversation_listing
      on conversation_listing.id = conversation_target.listing_id
    left join public.organization_members accepted_member
      on accepted_member.id = scoped.metadata_member_id
    left join public.profiles target_profile
      on target_profile.id = coalesce(scoped.metadata_target_user_id, accepted_member.user_id)
    left join public.organization_member_invites invite_target
      on invite_target.id = case
        when scoped.target_type = 'organization_invite' then scoped.target_uuid
        else null
      end
    left join public.profiles invite_target_profile
      on invite_target_profile.id = invite_target.target_user_id
    left join public.organizations organization_target
      on organization_target.id = coalesce(
        case
          when scoped.target_type = 'organization' then scoped.target_uuid
          else null
        end,
        scoped.metadata_organization_id
      )
    where coalesce(
      listing_target.organization_id,
      conversation_listing.organization_id,
      invite_target.organization_id,
      case
        when scoped.target_type = 'organization' then scoped.target_uuid
        else null
      end,
      scoped.metadata_organization_id
    ) = p_organization_id
  ),
  combined as (
    select * from listing_events
    union all
    select * from audit_events
  )
  select
    combined.event_id,
    combined.event_source,
    combined.event_type,
    combined.occurred_at,
    combined.actor_user_id,
    combined.actor_display_name,
    combined.target_id,
    combined.target_label,
    combined.metadata
  from combined
  order by combined.occurred_at desc
  limit v_limit;
end;
$$;

comment on function public.get_company_dashboard_activity_feed(uuid, uuid, integer) is
  'Returns trusted company activity feed rows from workflow and organization audit events for reviewer-capable roles.';

revoke all on function public.get_company_dashboard_activity_feed(uuid, uuid, integer) from public;
grant execute on function public.get_company_dashboard_activity_feed(uuid, uuid, integer)
  to authenticated, service_role;

commit;
