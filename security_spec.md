# PIXI STAKING Security Specification

## 1. Data Invariants

- **User Profiles**: Every user must have a unique UID. Balance can never be negative. Total commissions earned can never be negative. Role is immutable for non-admins.
- **Investments**: Cannot exist without a valid User ID. Amount must be positive. Status transitions must be strictly controlled (e.g., once completed, it's terminal).
- **Deposits/Withdrawals**: Must be linked to a valid User ID. Status defaults to 'pending'. Approved/Rejected can only be set by admins.
- **Referrals**: Links two users. `isActiveInvestor` can only be updated when an investment is made.
- **Notifications**: System-wide. Only admins can create/update/delete.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Balance Hijack**: User attempts to update their own `balance` field without a deposit.
2. **Admin Privilege Escalation**: User attempts to set their `role` to 'admin' during registration.
3. **Ghost Deposit**: User attempts to create a `deposit` with status 'approved'.
4. **Referral Spoof**: User attempts to create a referral record for themselves as the referrer.
5. **Withdrawal Overdraft**: User attempts to withdraw more than their current balance (logic check in app, but rules should prevent unauthorized amount changes).
6. **Negative Investment**: User attempts to invest a negative amount.
7. **Terminal State Reset**: User attempts to change an 'approved' deposit back to 'pending'.
8. **Shadow Field Injection**: User attempts to add a `isVerified: true` field to their profile.
9. **Email Spoofing**: User with unverified email attempts to access admin routes by naming their email `admin@pixi.com`.
10. **Notification Spam**: Non-admin attempts to post a system notification.
11. **Investment Theft**: User attempts to edit another user's investment `endDate`.
12. **Unauthorized List**: Authenticated user attempts to list all users' private profile data without a referral link query.

## 3. Test Runner (Conceptual)

The `firestore.rules.test.ts` will verify that these payloads return `PERMISSION_DENIED`.
