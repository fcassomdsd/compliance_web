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
| `planner` | Plan and assign inspections | Assign inspectors, inspection plans |
| `cap_entry` | Submit corrective actions | CAP submission to findings |
| `reporter` | Generate reports | Report viewing and generation |

## Step 1: Create Alfresco Groups

In Alfresco, create groups corresponding to each application role. Recommended group naming:

1. **admin** → Create group: `app-admin`
2. **inspector** → Create group: `app-inspector`  
3. **planner** → Create group: `app-planner`
4. **cap_entry** → Create group: `app-cap-entry`
5. **reporter** → Create group: `app-reporter`

### Via Alfresco Share UI

1. Log into Alfresco Share as an administrator
2. Go to **Administration** → **Groups**
3. Create a new group for each role:
   - Click **Create Group**
   - Enter group identifier (e.g., `app-cap-entry`)
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
  Groups: app-inspector, app-admin (if also admin)

User: jane.planner
  Groups: app-planner

User: bob.cap-entry
  Groups: app-cap-entry
```

## Step 3: Create Role Mappings in Database

The application uses PostgreSQL to map Alfresco groups to application roles. The mapping table is `alfresco_group_role_map`.

### Example Setup via SQL

```sql
-- Note: These role IDs should match your app_role table.
-- First, verify the role IDs:
SELECT id, role_key FROM app_role;

-- Then create the mappings.
-- Replace '<admin-role-uuid>' with the actual UUID from your app_role table.

INSERT INTO alfresco_group_role_map (alfresco_group, role_id, is_active, priority)
VALUES
  ('app-admin', '<admin-role-uuid>', true, 1),
  ('app-inspector', '<inspector-role-uuid>', true, 10),
  ('app-planner', '<planner-role-uuid>', true, 10),
  ('app-cap-entry', '<cap-entry-role-uuid>', true, 10),
  ('app-reporter', '<reporter-role-uuid>', true, 10)
ON CONFLICT (alfresco_group, role_id) DO NOTHING;
```

### Or, using psql directly:

```bash
# Connect to the database
psql -h localhost -U postgres -d compliance_db

# Get the role IDs
SELECT id, role_key FROM app_role;

# Copy the UUIDs and substitute them in the INSERT statement above
```

## Step 4: Test the Setup

### Test CAP Entry Role (Most Common Issue)

1. **In Alfresco Share:**
   - Log in as a user in the `app-cap-entry` group
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
   - Verify `app-cap-entry` is listed

2. **Check database mapping** via SQL:
   ```sql
   SELECT * FROM alfresco_group_role_map 
   WHERE alfresco_group = 'app-cap-entry';
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
   - In Alfresco Share, confirm user is in a mapped group (e.g., `app-cap-entry`)

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

Create the mapping in the database:

```sql
-- Get the cap_entry role id
SELECT id FROM app_role WHERE role_key = 'cap_entry';

-- Create the mapping (replace UUID with output above)
INSERT INTO alfresco_group_role_map (alfresco_group, role_id, is_active, priority)
VALUES ('app-cap-entry', '<uuid-from-above>', true, 10);
```

### User Still Can't Access After Mapping

1. User must **log out completely** and **log back in**
2. Check that the backend can reach Alfresco
3. Verify Alfresco groups are spelled consistently (case-sensitive):
   - Alfresco group: `app-cap-entry` (exact spelling)
   - Database mapping: `app-cap-entry` (must match exactly)

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
- [Auth Chunk 1 SQL Draft](AUTH_CHUNK1_SQL_DRAFT.sql) - Database schema
- [Operational Readiness](AUTH_CHUNK8_OPERATIONAL_READINESS.md) - Deployment and troubleshooting

