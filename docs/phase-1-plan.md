# Phase 1: Core Food Logging (CRUD)

## What This Phase Is About

Phase 0 set up the workshop. Phase 1 builds the first real thing: the **core loop** every user will repeat hundreds of times.

**Take a photo → Fill in details → Save to database → See it on the home page → Edit or delete it**

Everything else in the app (AI, location, chat, analytics) is just making this loop smarter. If this loop doesn't feel good, nothing else matters.

---

## New Concepts You'll Learn

### 1. CRUD Operations
CRUD = **Create, Read, Update, Delete** -- the four things you can do with any piece of data. Nearly every app is just CRUD with a nice skin.

| Operation | In your app | What it means |
|-----------|------------|---------------|
| **Create** | Log a new meal | Insert a new row into the database |
| **Read** | View your food feed | Fetch rows from the database |
| **Update** | Edit a meal's description | Change an existing row |
| **Delete** | Remove a wrong entry | Delete a row |

### 2. Database Schema
A schema is the **blueprint** for your database. Think of it like designing a spreadsheet before filling it in -- the header row defines what columns exist, what type of data each column holds, and what constraints apply (e.g., "dish name can't be empty").

### 3. File Storage
Photos aren't stored in the database itself (databases are for structured text/numbers). Photos go into **Supabase Storage** (a cloud folder), and the database stores a *link* to the photo. Like how an email attachment is stored separately and linked.

Flow: **User picks photo → Upload to Storage → Get URL → Save URL in database**

### 4. Controlled Forms in React
In React, every input field is "controlled" -- React tracks what's typed in real-time using `useState`. As you type "Pul" → "Pula" → "Pulao", React knows the value at every keystroke. This enables live validation and auto-save.

### 5. URL Parameters
Routes like `/entry/:id` have a dynamic segment (`:id`). React Router's `useParams()` hook lets you read that value. So `/entry/abc-123` gives you `{ id: "abc-123" }`. This is how every detail page on the internet works.

### 6. Async UI Patterns
Every Supabase call is asynchronous -- the app sends a request and waits. During that wait, users need feedback:

```
Idle → Loading... → Success! (or Error)
```

This is why apps show spinners, disabled buttons, and error messages.

---

## What Phase 1 Does NOT Include (and Why)

| Deferred | Why |
|----------|-----|
| EXIF metadata extraction | Building manual entry first, then making it smarter |
| Authentication (login) | Would complicate every database query |
| AI food recognition | Need manual flow working before automating |
| Location/GPS | Adds API complexity; nail the core loop first |
| Analytics | Need data before analyzing it |

---

## Implementation Plan

### Step 1: Supabase Dashboard Setup (User Action)

**Create the `entries` table** in SQL Editor:
```sql
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  photo_url TEXT,
  dish_name TEXT NOT NULL,
  venue_name TEXT,
  entry_type TEXT DEFAULT 'eating_out' CHECK (entry_type IN ('eating_out', 'home_cooked')),
  cost NUMERIC,
  companions TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  ate_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON entries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON entries FOR DELETE USING (true);
```

**Create `meal-photos` storage bucket** in Supabase Storage (public bucket).

### Step 2: Data Layer
- `src/lib/entries.js` -- all CRUD functions (getEntries, getEntry, createEntry, updateEntry, deleteEntry)
- `src/lib/storage.js` -- photo upload/delete helpers

### Step 3: Shared Components
- `src/components/PageShell.jsx` -- consistent page layout wrapper
- `src/components/PhotoUpload.jsx` -- photo picker with preview
- `src/components/StarRating.jsx` -- 1-5 star rating input

### Step 4: Entry Form
- `src/components/EntryForm.jsx` -- shared form for Add and Edit pages
- Fields: photo, dish name, entry type toggle, venue, date/time, cost, companions, rating, notes

### Step 5: Add Page (Create)
- Modify `src/pages/Add.jsx` -- replace placeholder with real form

### Step 6: Home Page Entry List (Read List)
- `src/components/EntryCard.jsx` -- thumbnail card
- Modify `src/pages/Home.jsx` -- show entry list instead of test box

### Step 7: Entry Detail Page (Read Single)
- `src/pages/Entry.jsx` -- full detail view
- Route: `/entry/:id`

### Step 8: Edit Page (Update)
- `src/pages/Edit.jsx` -- edit form pre-filled with existing data
- Route: `/edit/:id`

### Step 9: Delete with Confirmation
- `src/components/ConfirmDialog.jsx` -- modal dialog
- Wire into Entry detail page

### Step 10: Polish
- Empty states, loading indicators, form validation, cost formatting, mobile keyboard support

---

## File Map After Phase 1

```
src/
  App.jsx                  ← MODIFY (add /entry/:id and /edit/:id routes)
  lib/
    supabase.js            ← NO CHANGE
    entries.js             ← NEW (CRUD functions)
    storage.js             ← NEW (photo upload/delete)
  pages/
    Home.jsx               ← MODIFY (test box → entry list)
    Add.jsx                ← MODIFY (placeholder → real form)
    Entry.jsx              ← NEW (detail view)
    Edit.jsx               ← NEW (edit form)
  components/
    PageShell.jsx          ← NEW (layout wrapper)
    EntryForm.jsx          ← NEW (shared form)
    PhotoUpload.jsx        ← NEW (photo picker + preview)
    StarRating.jsx         ← NEW (1-5 rating)
    EntryCard.jsx          ← NEW (list thumbnail)
    ConfirmDialog.jsx      ← NEW (delete confirmation)
```

No new npm dependencies.
