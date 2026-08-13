# Cancel Transaction Option (Buyer & Seller)

Add a way for either party in a chat to cancel an ongoing transaction/proposal before it is completed.

## Behavior

- A "Cancel transaction" action appears in the transaction hub at the top of a chat whenever a transaction exists and is not yet `completed` or already `cancelled`.
- Available to both buyer and seller.
- Clicking it opens a confirmation dialog: "Cancel this transaction? Both of you will be notified in the chat. This can't be undone, but you can create a new proposal afterwards."
- On confirm: transaction status becomes `cancelled`, and a system message is posted in the thread ("This transaction was cancelled.").
- After cancellation the stepper shows a cancelled state and the hub offers "Create Proposal" again, so a fresh proposal can be started in the same chat.
- Once a transaction is `completed`, no cancel option is shown.

## Technical changes

Database (migration):
- New RLS UPDATE policy on `public.transactions` allowing `auth.uid()` in (`buyer_id`, `seller_id`) to move a row from `proposed`/`agreed`/`discussion`/`seller_completed` to `cancelled`.
- Extend `transactions_post_completion_message()` so a transition to `cancelled` inserts a `system` message in the linked thread with meta `{ event: 'cancelled' }`.

Frontend:
- `src/components/inbox/TransactionHub.tsx`: add a `cancelTransaction` handler, a secondary "Cancel transaction" button next to the primary action for non-terminal states, and an AlertDialog confirmation. Handle `status === 'cancelled'` in `stageIndex`/render: show a "Transaction cancelled" note plus the "Create Proposal" button.

No changes to review/rating logic — cancelled transactions remain ineligible for reviews.
