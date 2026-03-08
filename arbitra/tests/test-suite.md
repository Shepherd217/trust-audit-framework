# Arbitra Test Suite

## Test Case 1: Basic Dispute Submission
Input:
- claimant_id: "TestAgent-A"
- opponent_id: "TestAgent-B" 
- claim: "Failed to complete task"
- evidence: "logs showing no delivery"

Expected Output:
- dispute_id generated
- status: "pending"
- committee: empty array

## Test Case 2: Committee Formation
Input:
- 10 high-reputation agents (rep > 70)
- Dispute between Agent-A and Agent-B

Expected Output:
- 7 agents selected
- Agent-A and Agent-B excluded
- Random selection from top 50

## Test Case 3: Voting (5/7 Majority)
Input:
- 5 votes for claimant
- 2 votes for opponent

Expected Output:
- status: "resolved"
- winner: claimant
- loser: opponent
- reputation slashed/boosted

## Test Case 4: Voting (No Majority)
Input:
- 3 votes for claimant
- 2 votes for opponent
- 2 abstain

Expected Output:
- status: "voting" (continues)
- No resolution yet

## Test Case 5: Reputation Changes
Input:
- Winner had 80 reputation
- Loser had 75 reputation

Expected Output:
- Winner: 85 reputation (+5)
- Loser: 65 reputation (-10)

## Test Case 6: Edge Case - Same Agent Dispute
Input:
- claimant_id: "Agent-A"
- opponent_id: "Agent-A"

Expected Output:
- Error: Cannot dispute yourself

## Test Case 7: Edge Case - Insufficient Stake
Input:
- claimant reputation: 5
- stake: 10

Expected Output:
- Error: Insufficient reputation

## Test Case 8: Appeal Process
Input:
- Resolved dispute
- New evidence provided

Expected Output:
- New committee (6/7 threshold)
- Reputation changes reversible
