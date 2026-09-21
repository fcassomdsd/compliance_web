-- ---------------------------------------------------------------------------
-- Alfresco group -> application role mappings
--
-- `0001` seeds the role catalog but no mappings, and `0002` added only
-- `closure_reviewer`. Every other role's mapping lived as deployment data, so a
-- fresh install had a full role catalog that nothing could reach: the demo's
-- `demo.inspector1`, created in `U-VSO-IN_Inspector` by
-- compliance_cmis/scripts/seed-demo-identities.sh, authenticated with no roles
-- at all and was refused by every gated route.
--
-- These are the group names the reference deployment (IDAC) uses and the demo
-- scripts create. They are the *adopting authority's* names, not a product
-- constant: an authority with its own naming adds its own rows (or renames these)
-- and nothing else changes — the lookup is by name, it strips a leading `GROUP_`
-- and compares case-insensitively, and a mapping whose group does not exist in
-- Alfresco is simply inert. See docs/auth/ALFRESCO_ROLE_SETUP.md and the repo
-- root's COUNTRY_ADAPTATION_GUIDE.md.
--
-- `priority` follows the convention already in the table: 1 for admin, 50 for
-- closure_reviewer (set by 0002), 10 for the rest. Nothing reads it yet —
-- `resolveRolesForGroups` returns every mapped role — so it is descriptive only.
--
-- Re-runnable: every statement is ON CONFLICT DO NOTHING, and this is additive.
-- It never deactivates or removes a mapping a deployment added, with the one
-- deliberate exception at the end.
-- ---------------------------------------------------------------------------

INSERT INTO alfresco_group_role_map (alfresco_group, role_id, is_active, priority)
SELECT mapping.alfresco_group, app_role.id, TRUE, mapping.priority
FROM (
  VALUES
    ('U-VSO-IN_Admin',          'admin',     1),
    ('U-VSO-IN_Inspector',      'inspector', 10),
    ('U-VSO-PI_PlanInspeccion', 'planner',   10),
    ('U-VSO-IN_Assigner',       'assigner',  10),
    ('U-VSO-FN_CAPEntry',       'cap_entry', 10),
    -- `reporter` had no group anywhere, so the role was unreachable. This name
    -- follows the same convention; create the group in Alfresco to use it.
    ('U-VSO-IN_Reporter',       'reporter',  10)
) AS mapping (alfresco_group, role_key, priority)
JOIN app_role ON app_role.role_key = mapping.role_key
ON CONFLICT (alfresco_group, role_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Retire `U-VSO-EL_EspecialistaLider` -> `mainInspector`
--
-- A deployment-added mapping to a role no code has ever referenced: a user
-- holding only it authenticated and was refused everywhere. Being *main
-- inspector* is a per-site-visit attribution — anyone can be the lead on one
-- visit and not the next, which is how the domain model already carries it
-- (`SiteVisit.mainInspectorId`) — so it cannot be a standing group membership.
--
-- Deactivated rather than deleted, so the row remains visible as a decision.
-- A no-op on any deployment that never had it.
-- ---------------------------------------------------------------------------

UPDATE alfresco_group_role_map
SET is_active = FALSE, updated_at = NOW()
WHERE alfresco_group = 'U-VSO-EL_EspecialistaLider'
  AND is_active;
