# Alfresco Role and Group Setup Guide

This guide explains how to set up Alfresco groups and map them to application roles for the Inspection Checklist Manager.

## Overview

The application authenticates users through Alfresco and assigns roles based on group membership. Users must:
1. Have an Alfresco account
2. Be members of Alfresco groups
3. Have those groups mapped to application roles in the database

## Available Application Roles

| Role | Purpose | API Access |
|------|---------|-----------|
| `admin` | Full system access | All endpoints |
| `inspector` | Execute inspections, manage findings | Findings, CAP review, reports |
| `planner` | Plan inspections | Inspection plans |
| `assigner` | Assign inspectors to specialties | `/assign-inspectors` |
| `cap_entry` | Submit corrective actions | CAP submission to findings |
| `reporter` | Generate reports | Report viewing and generation |
| `closure_reviewer` | Verify a declared finding closure (supervising authority) | Read findings (`/api/findings`, `/api/findings/:findingId`, follow-ups and evidence content) + the one write, `PATCH /api/findings/:findingId/closure-review` |

`assigner` was previously scoped to a subset of specialties by AGA/SNA/VA Alfresco-group membership (a separate mechanism from this role mapping). That domain-based scoping was retired along with the domain grouping itself — anyone with the `assigner` role now sees/acts on all 16 specialties, with no further group-based restriction.

## Step 1: Create Alfresco Groups

Create one group per application role. **These names are already mapped** — the
migration `0003_group_role_mappings.sql` seeds the group → role rows, so creating the
group in Alfresco and adding the user to it is all that is needed:

| Role | Alfresco group |
|---|---|
| `admin` | `U-VSO-IN_Admin` |
| `inspector` | `U-VSO-IN_Inspector` |
| `planner` | `U-VSO-PI_PlanInspeccion` |
| `assigner` | `U-VSO-IN_Assigner` |
| `cap_entry` | `U-VSO-FN_CAPEntry` |
| `reporter` | `U-VSO-IN_Reporter` |
| `closure_reviewer` | `U-VSO-IN_ClosureReviewer` |

The lookup strips a leading `GROUP_` and compares case-insensitively, so both
`U-VSO-IN_Inspector` and `GROUP_U-VSO-IN_Inspector` match the seeded row.

> These are the **adopting authority's** group names, not a product constant. An
> authority with its own naming adds its own rows to `alfresco_group_role_map` (Step 3)
> or renames these; nothing else in the application changes. See
> `COUNTRY_ADAPTATION_GUIDE.md` at the repo root.

> `U-VSO-EL_EspecialistaLider` is **not** a role group. Being main inspector is a
> per-site-visit attribution (`SiteVisit.mainInspectorId`), so it is not something a
> standing group membership can express; `0003` deactivates any mapping for it.

> **For a demo deployment this is scripted**: `compliance_cmis/scripts/seed-demo-identities.sh`
> creates the groups, the demo users, their memberships and the repository access in one
> idempotent command. The notes below explain what it does and why the permission part is
> per user rather than per group.

## Step 2: Grant the group repository permissions

**An application role does not grant an Alfresco permission.** The server authorises a
route by role, but it performs the underlying Alfresco call with the *user's own
ticket*, so the repository enforces its own ACLs on top. A role whose group has no
repository permission authenticates, passes the role gate, and then fails the write
with `403` from Alfresco — which surfaces as `502` from the API.

Every role that writes must therefore have the equivalent repository permission.
The pattern in use is site membership on `vigilancia-de-la-so`:

```bash
curl -u "$ALFRESCO_USERNAME:$ALFRESCO_PASSWORD" -X POST \
  "http://localhost:8080/alfresco/api/-default-/public/alfresco/versions/1/sites/vigilancia-de-la-so/members" \
  -H 'Content-Type: application/json' \
  -d '{"id":"<group-or-user>","role":"SiteCollaborator"}'
```

**A group can hold this.** `GROUP_U-VSO-IN_Inspector` is a SiteConsumer of the site with
Contributor on `Datos de campo` and `Hallazgos` — Consumer at the site, Contributor only where
the role writes. Prefer that shape for a new role: narrower than site-wide Collaborator, and it
needs no per-user membership.

Known limitation (verified 2026-09-15): the v1 site-members endpoint returns `404`
for a *group* id in this deployment — both `U-VSO-IN_ClosureReviewer` and
`GROUP_U-VSO-IN_ClosureReviewer` — while the same endpoint accepts a *person* and
returns `201`; the legacy `/alfresco/service/api/sites/{site}/memberships` endpoint
with `groupId` returned `400`. Until that is resolved, a group-level grant has to be
made in Share (or by another route), and per-user membership is the workaround. This
is the same shape as the operator-identity grant recorded in
`TECHNICAL_DEBT_ANALYSIS.md` (`GROUP_U-VSO-IN_Inspector` as SiteCollaborator, needed
only so the importer can write as the operator).

`closure_reviewer` needs it: the review writes `vso:findingStatus` and
`vso:closureRejectionReason`, and sets `vso:findingClosureDate` on approval or clears
it on rejection (an open finding must never carry a closure date).

### Via Alfresco Share UI

1. Log into Alfresco Share as an administrator
2. Go to **Administration** → **Groups**
3. Create a new group for each role:
   - Click **Create Group**
   - Enter group identifier (e.g., `U-VSO-FN_CAPEntry`)
   - Enter display name (e.g., `CAP Entry Users`)
   - Click **Create Group**
4. For each group, add users:
   - Click the group name
   - Click **Add User to Group**
   - Search for and select users
   - Click **Add**

## Step 2: Add Users to Groups

Once groups are created, add your users to the appropriate groups based on their roles:

```
User: john.inspector
  Groups: U-VSO-IN_Inspector

User: jane.planner
  Groups: U-VSO-PI_PlanInspeccion

User: bob.cap-entry
  Groups: U-VSO-FN_CAPEntry
```

Membership is the only thing that grants a role, and a user may hold several. Note that
a second role **removes the specialty scope**: a planner who also holds `U-VSO-IN_Inspector`
because they occasionally run an inspection works as a planner and sees every specialty.
See [`SPECIALTY_SCOPE_ENFORCEMENT.md`](SPECIALTY_SCOPE_ENFORCEMENT.md).

## Step 3: Role mappings in the database

**Nothing to do for the roles in Step 1** — `migrations/0003_group_role_mappings.sql`
seeds them, and `npm run db:migrate` applies it. Confirm with:

```sql
SELECT m.alfresco_group, r.role_key, m.is_active
FROM alfresco_group_role_map m
JOIN app_role r ON r.id = m.role_id
ORDER BY r.role_key;
```

### Adding a mapping for your own group name

Only needed when the authority uses different group names, or when one role is held by
more than one group. Match on `role_key` rather than pasting a UUID:

```sql
INSERT INTO alfresco_group_role_map (alfresco_group, role_id, is_active, priority)
SELECT 'YOUR-GROUP-NAME', id, TRUE, 10
FROM app_role
WHERE role_key = 'cap_entry'
ON CONFLICT (alfresco_group, role_id) DO NOTHING;
```

`priority` is descriptive only — `resolveRolesForGroups` returns every active mapped
role, and authorization is an any-role match. To retire a mapping, set
`is_active = FALSE` rather than deleting it; the resolver requires `is_active` on both
the mapping and the role.

## Step 4: Test the Setup

### Test CAP Entry Role (Most Common Issue)

1. **In Alfresco Share:**
   - Log in as a user in the `U-VSO-FN_CAPEntry` group
   - Confirm the user appears in that group

2. **In the Application:**
   - Navigate to the Findings view
   - You should see a list of findings (if any exist)
   - Navigate to Corrective Actions view
   - Fill out the "Submit CAP" form with:
     - Finding ID (from existing finding)
     - CAP ID (unique identifier)
     - Proposed Action (description)
     - Responsible Entity (who will handle it)
     - Due Date (when it's due)
   - Click **Submit CAP**
   - You should see: `"CAP submitted successfully."`

3. **In Alfresco:**
   - Navigate to a Finding document
   - You should see a new child document named `CAP-{capId}`
   - The CAP node should have properties set correctly

### If Submission Fails

If you see an error message like **"Role not authorized for this operation"** (HTTP 403):

1. **Check user group membership** in Alfresco Share
   - Navigate to **Administration** → **Groups**
   - Click your user's groups
   - Verify `U-VSO-FN_CAPEntry` is listed

2. **Check database mapping** via SQL:
   ```sql
   SELECT * FROM alfresco_group_role_map 
   WHERE alfresco_group = 'U-VSO-FN_CAPEntry';
   ```
   - Should return one row with `is_active = true`

3. **Check session** via browser console or Network tab:
   - Call the API endpoint: `GET /api/auth/session`
   - Look for the `roles` array
   - Should include `"cap_entry"`

## Step 5: Verify Role Refresh

After adding a user to a group, the application caches roles in the session. The session is typically refreshed:
- On next login
- After manual session refresh (if available)
- On session expiry and re-login

If you've just added a user to a group, they may need to **log out and log back in** for the new role to become available.

## Troubleshooting

### User Can Login but Cannot Submit CAP

**Check these in order:**

1. **User's Alfresco groups:**
   - In Alfresco Share, confirm user is in a mapped group (e.g., `U-VSO-FN_CAPEntry`)

2. **Group-to-role mapping in database:**
   ```sql
   SELECT * FROM alfresco_group_role_map WHERE is_active = true;
   ```

3. **Session roles:**
   - Open browser DevTools → Network tab
   - Log in and navigate to any protected page
   - Look for request to `/api/auth/session`
   - Verify `roles` array contains `"cap_entry"`

4. **Check application logs:**
   - Backend logs should show authorization checks
   - Look for lines containing `requireRole` or authorization errors

### Group Exists but Mapping is Missing

Only happens for a group name the authority added itself — the names in Step 1 are
seeded. Add it with the `role_key` form in Step 3, and check the migration actually ran:

```sql
SELECT filename FROM schema_migrations ORDER BY filename;
```

### User Still Can't Access After Mapping

1. User must **log out completely** and **log back in**
2. Check that the backend can reach Alfresco
3. Verify the group name matches the mapping. The comparison is **not** case-sensitive
   and a leading `GROUP_` is stripped, so `GROUP_U-VSO-FN_CAPEntry` and
   `u-vso-fn_capentry` both match the seeded row — but a different name entirely (a
   typo, or a group the authority renamed) grants nothing.

## API Reference

### Creating CAP (Requires `cap_entry` Role)

**Endpoint:** `POST /api/findings/{findingId}/caps`

**Required Headers:**
- `X-CSRF-Token`: CSRF token from session
- `Cookie`: Session cookie (sent automatically by browser)

**Request Body:**
```json
{
  "capId": "CAP-2024-001",
  "proposedAction": "Replace faulty component",
  "responsibleEntity": "Maintenance Team",
  "dueDate": "2024-06-30"
}
```

**Responses:**
- `201 Created`: CAP submitted successfully
- `400 Bad Request`: Missing required fields
- `403 Forbidden`: User lacks `cap_entry` role (see troubleshooting above)
- `404 Not Found`: Finding not found
- `409 Conflict`: CAP ID already exists

## Related Documentation

- [Authentication Chunk 1 Route Auth Matrix](AUTH_CHUNK1_ROUTE_AUTH_MATRIX.md) - Role and route mapping
- [Initial database schema](../../../migrations/0001_initial_schema.sql) - Database schema
- [Operational Readiness](./AUTH_CHUNK8_OPERATIONAL_READINESS.md) - Deployment and troubleshooting

