# Security Specification: OrganizAI Firestore Security Model

## 1. Data Invariants
1. **User Profile Invariant**: A user document at `/users/{userId}` can only be read or written by the authenticated user whose `request.auth.uid == userId`.
2. **Family Membership Invariant**: A family subcollection resource (`transactions`, `categories`, `budgets`, `goals`, `planningItems`) can only be read or written if the authenticated user is a valid member of `/families/{familyId}/members/{request.auth.uid}` or the family's `created_by`.
3. **Transaction Identity Invariant**: When creating a transaction, `incoming().created_by` must strictly equal `request.auth.uid`.
4. **Transaction Immutability Invariant**: On transaction updates, `family_id` and `created_by` are immutable and cannot be changed.
5. **String Bound Invariant**: All textual descriptions, category labels, and names must enforce length boundaries (e.g. `description.size() <= 200`).
6. **Non-Negative Amount Invariant**: Transaction amounts, budgets, and goal target amounts must be numeric and non-negative.

---

## 2. The "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)

1. **Payload 1: Unauthenticated Read on Family**
   - Attempt: `get(/families/fam_123)` without `request.auth`.
   - Expected: `PERMISSION_DENIED`.

2. **Payload 2: Profile Spoofing Write**
   - Attempt: Auth user `uid_alice` writes to `/users/uid_bob`.
   - Expected: `PERMISSION_DENIED`.

3. **Payload 3: Non-Member Transaction Injection**
   - Attempt: Auth user `uid_stranger` attempts to write to `/families/fam_123/transactions/tx_1`.
   - Expected: `PERMISSION_DENIED`.

4. **Payload 4: Transaction Identity Spoofing**
   - Attempt: Auth user `uid_alice` creates transaction setting `created_by: "uid_bob"`.
   - Expected: `PERMISSION_DENIED`.

5. **Payload 5: Giant String DoS Attack (Denial of Wallet)**
   - Attempt: Transaction description containing a 500KB string payload exceeding `maxLength: 200`.
   - Expected: `PERMISSION_DENIED`.

6. **Payload 6: Negative Transaction Amount**
   - Attempt: Creating a transaction with `amount: -5000` (tampered sign).
   - Expected: `PERMISSION_DENIED`.

7. **Payload 7: Invalid Transaction Type**
   - Attempt: Creating a transaction with `type: "crypto_transfer"` (not in `['income', 'expense']`).
   - Expected: `PERMISSION_DENIED`.

8. **Payload 8: Immutable Family ID Tampering on Transaction Update**
   - Attempt: Updating an existing transaction at `/families/fam_1/transactions/tx_1` to change `family_id: "fam_2"`.
   - Expected: `PERMISSION_DENIED`.

9. **Payload 9: Path Traversal / Poisoned Document ID**
   - Attempt: Writing to `/families/fam_1/transactions/../../evil_doc` or non-regex IDs.
   - Expected: `PERMISSION_DENIED`.

10. **Payload 10: Unauthorized Budget Modification by Non-Member**
    - Attempt: Writing to `/families/fam_1/budgets/b_1` by a non-member.
    - Expected: `PERMISSION_DENIED`.

11. **Payload 11: Goal State Tampering / Extra Ghost Keys**
    - Attempt: Adding unvalidated keys `{ status: "active", adminBackdoor: true }` violating strict entity schema keys.
    - Expected: `PERMISSION_DENIED`.

12. **Payload 12: Blanket Collection Scraping (List Without Query Constraint)**
    - Attempt: Querying top-level collections or unauthorized family transactions without valid membership.
    - Expected: `PERMISSION_DENIED`.

---

## 3. Test Runner Specification (`firestore.rules.test.ts`)
The test runner asserts that:
- Every unauthenticated request receives `PERMISSION_DENIED`.
- Cross-user modifications on `/users/{userId}` fail.
- Cross-family transactions injection fails with `PERMISSION_DENIED`.
- Length validation failures are rejected immediately before database execution.
