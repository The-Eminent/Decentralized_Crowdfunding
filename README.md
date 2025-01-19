# Decentralized Crowdfunding Platform

## Project Overview
This project is a **Decentralized Crowdfunding Platform** built on Ethereum smart contracts, using **Solidity**, **Truffle**, and a **React.js** frontend with **Web3** integration.  

### Features for Creators
- Create crowdfunding projects with funding goals and deadlines.
- Receive contributions from backers.
- Withdraw funds if the funding goal is met and approved by trusted signers.

### Features for Backers
- Contribute to projects in USD terms (converted to ETH at a fixed, hardcoded rate).
- Leave a comment along with their contribution.
- Be recognized as a **top donor** if their contribution is among the highest.

---

## Final Features Implemented

1. **User Registration**  
   Users can register a readable name on-chain instead of relying solely on Ethereum addresses.  

2. **ETH-to-USD Conversion**  
   Projects display funding goals and contributions in USD using a fixed ETH/USD rate to simplify demonstrations.  

3. **Project Creation & Management**  
   Users create projects with:
   - Title, description, funding goal (in USD), and a strict deadline.
   - Validation ensures deadlines are in the future.

4. **Funding with Comments**  
   Contributors can:
   - Fund projects.
   - Store an on-chain comment, adding personality and context to their contributions.

5. **Top Donors Section**  
   Displays the top 3 donors per project, including:
   - Their chosen names, amounts (in USD), and comments.
   - Encourages user engagement and transparency.

6. **Referral System**  
   - Users can share referral links (`?ref=<address>`).  
   - Successful referrals award:
     - Referral counts.
     - Referral points (claimable as rewards).

7. **Multi-Signature Approvals for Withdrawals**  
   - Implemented a secure withdrawal mechanism.
   - Requires approval from trusted signers, preventing unauthorized fund releases.

8. **Real-Time UI Updates**  
   On-chain events (e.g., project creation, funding, withdrawals) dynamically update the frontend without manual refresh.

9. **Comment Display**  
   Comments are stored on-chain and displayed per contribution, building trust and narrative around projects.

10. **Micropayment Channel (Conceptual)**  
    Showcases how off-chain signed messages can facilitate efficient microtransactions.  
    (Only partially implemented.)

11. **Status Tracking**  
    Displays:
    - Remaining days until the project deadline.
    - Whether funding is open or closed.

12. **User-Friendly UI/UX**  
    - Clean Material-UI interface.  
    - Includes progress bars, labels, and intuitive designs.

13. **Hardcoded Defaults**  
    - Fixed ETH-to-USD rate ($4000/ETH) to avoid external API calls and potential CORS issues during the demonstration.
    - Trusted signers for multi-sig and referral logic are predefined to ensure a stable and controlled demo environment.

---

## How to Run the Project

### 1. Clone the Repository
```bash
git clone https://github.com/The-Eminent/Adv-Blockchain-Final-Project
cd decentralized-crowdfunding
npm install
truffle compile
truffle migrate --reset
cd client
npm install
npm start
