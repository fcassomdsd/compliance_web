-- ---------------------------------------------------------------------------
-- closure_reviewer role
--
-- Closing a finding is a two-step gate: a valid Closure Verification follow-up
-- only moves it to "Pending Closure Approval", and a separate reviewer verifies
-- the closure. Until now that review route was authorised to
-- ('inspector', 'admin'), so any inspector could approve a closure - including
-- the one they declared themselves.
--
-- This adds the supervising-authority role. The Alfresco group it maps to is
-- named U-VSO-IN_ClosureReviewer, matching the U-VSO-* convention the other rows
-- already use (the role lookup strips a leading GROUP_ and compares lowercased, so
-- it also matches the GROUP_U-VSO-IN_ClosureReviewer authority name).
-- created in Alfresco (see docs/auth/ALFRESCO_ROLE_SETUP.md); membership is what
-- grants the role, as for every other role in this application.
-- ---------------------------------------------------------------------------

INSERT INTO app_role (role_key, role_name)
VALUES ('closure_reviewer', 'Closure Reviewer')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO alfresco_group_role_map (alfresco_group, role_id, is_active, priority)
SELECT 'U-VSO-IN_ClosureReviewer', id, TRUE, 50
FROM app_role
WHERE role_key = 'closure_reviewer'
ON CONFLICT (alfresco_group, role_id) DO NOTHING;
