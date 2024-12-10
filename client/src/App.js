import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import Crowdfunding from './contracts/Crowdfunding.json';
import NameRegistryABI from './contracts/NameRegistry.json';
import MultiSigApproverABI from './contracts/MultiSigApprover.json';
import ReferralRewardsABI from './contracts/ReferralRewards.json';
import config from './contracts/config.json';
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  InputAdornment,
  LinearProgress,
  Box,
  Paper,
} from '@mui/material';
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles({
  form: {
    marginTop: '2rem',
  },
  projectCard: {
    marginBottom: '1rem',
    backgroundColor: '#f5f5f5',
  },
  fundInput: {
    marginTop: '1rem',
  },
  topDonors: {
    marginTop: '1rem',
  },
  comment: {
    fontStyle: 'italic',
    color: '#555',
  },
});

const ETH_RATE_USD = 4000; 
const TRUSTED_SIGNERS = [
  "0x116470dA168103C7329bB1c646b1Aca6308A8a83",
  "0x4efba98Ba5620891eb4Ea7dB04904DeeD2F760b6"
];

function App() {
  const classes = useStyles();
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState('');
  const [crowdfunding, setCrowdfunding] = useState(null);
  const [projects, setProjects] = useState([]);
  const [topDonors, setTopDonors] = useState({});
  const [userName, setUserName] = useState('');
  const [nameRegistry, setNameRegistry] = useState(null);
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    fundingGoalUSD: '',
    deadline: '',
  });
  const [multiSigApprover, setMultiSigApprover] = useState(null);

  const [referralRewards, setReferralRewards] = useState(null); 
  const [refParam, setRefParam] = useState(null); 
  const [myReferralCount, setMyReferralCount] = useState(0); 
  const [myReferralPoints, setMyReferralPoints] = useState(0);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refAddress = urlParams.get('ref');
    if (refAddress) {
      setRefParam(refAddress);
    }
  }, []);

  const refreshProjects = async () => {
    if (crowdfunding && nameRegistry) {
      await loadProjects();
    }
    // Also update referral data after potential changes
    if (referralRewards && account) {
      await fetchReferralData();
    }
  };

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          const accounts = await web3Instance.eth.getAccounts();
          if (accounts.length === 0) {
            alert('No accounts found. Please connect MetaMask.');
            return;
          }
          setAccount(accounts[0]);

          const nameRegistryInstance = new web3Instance.eth.Contract(
            NameRegistryABI.abi,
            config.nameRegistry
          );
          setNameRegistry(nameRegistryInstance);

          const storedName = await nameRegistryInstance.methods.getName(accounts[0]).call();
          setUserName(storedName || 'No name registered');

          const crowdfundingInstance = new web3Instance.eth.Contract(
            Crowdfunding.abi,
            config.crowdfunding
          );
          setCrowdfunding(crowdfundingInstance);

          const multiSigInstance = new web3Instance.eth.Contract(
            MultiSigApproverABI.abi,
            config.multiSigApprover
          );
          setMultiSigApprover(multiSigInstance);

          const referralInstance = new web3Instance.eth.Contract(
            ReferralRewardsABI.abi,
            config.referralRewards
          );
          setReferralRewards(referralInstance);

        } catch (error) {
          console.error('Error connecting to MetaMask:', error);
          alert('Could not connect to MetaMask. See console for details.');
        }
      } else {
        alert('MetaMask not installed.');
      }
    };
    init();
  }, []);

  const loadProjects = async () => {
    try {
      const projectCount = await crowdfunding.methods.projectCount().call();
      const projectsList = [];
      for (let i = 1; i <= projectCount; i++) {
        const project = await crowdfunding.methods.projects(i).call();
        const creatorName = await nameRegistry.methods.getName(project.creator).call();
        project.creatorName = creatorName || project.creator;
        projectsList.push(project);
      }
      setProjects(projectsList);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const fetchReferralData = async () => {
    if (referralRewards && account) {
      const count = await referralRewards.methods.getReferralCount(account).call();
      setMyReferralCount(parseInt(count, 10));

      const points = await referralRewards.methods.getReferralPoints(account).call();
      setMyReferralPoints(parseInt(points, 10));
    }
  };

  useEffect(() => {
    if (crowdfunding && nameRegistry) {
      loadProjects();
    }
  }, [crowdfunding, nameRegistry]);

  useEffect(() => {
    const loadTopDonors = async (projectId) => {
      try {
        const donations = await crowdfunding.methods.getDonations(projectId).call();
        donations.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
        const topThree = donations.slice(0, 3).map(d => ({ ...d, projectId }));
        const donorsWithNames = await Promise.all(
          topThree.map(async (donor) => {
            const donorName = await nameRegistry.methods.getName(donor.contributor).call();
            return {
              ...donor,
              name: donorName || donor.contributor,
            };
          })
        );
        setTopDonors((prev) => ({ ...prev, [projectId]: donorsWithNames }));
      } catch (error) {
        console.error('Error loading top donors:', error);
      }
    };

    if (projects.length > 0) {
      projects.forEach((p) => loadTopDonors(p.id));
    }
  }, [projects, crowdfunding, nameRegistry]);

  useEffect(() => {
    fetchReferralData();
  }, [referralRewards, account]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProjectForm((prev) => ({ ...prev, [name]: value }));
  };

  const isNameTaken = (name) => {
    for (let proj of projects) {
      if (proj.creatorName === name) return true;
    }
    for (let pid in topDonors) {
      for (let donor of topDonors[pid]) {
        if (donor.name === name) return true;
      }
    }
    return false;
  };

  const handleSetName = async () => {
    if (!nameRegistry || !account) return;
    if (userName === 'No name registered') {
      const name = prompt('Enter your name:');
      if (name) {
        if (isNameTaken(name)) {
          alert('This username is already taken.');
          return;
        }
        try {
          await nameRegistry.methods.registerName(name).send({ from: account });
          setUserName(name);
          await new Promise(res => setTimeout(res, 500));
          await refreshProjects();
        } catch (err) {
          console.error('Error registering name:', err);
          alert('Failed to register name.');
        }
      }
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (!crowdfunding || !web3 || !account) return;
    if (userName === 'No name registered') {
      alert('Please set your name first.');
      return;
    }
    const { title, description, fundingGoalUSD, deadline } = projectForm;
    if (!title || !description || !fundingGoalUSD || !deadline) {
      alert('All fields required.');
      return;
    }
    const fundingGoalUSDNumber = parseFloat(fundingGoalUSD);
    if (isNaN(fundingGoalUSDNumber) || fundingGoalUSDNumber <= 0) {
      alert('Positive funding goal required.');
      return;
    }
    const fundingGoalETH = fundingGoalUSDNumber / ETH_RATE_USD;
    const fundingGoalWei = web3.utils.toWei(fundingGoalETH.toString(), 'ether');
    const [year, month, day] = deadline.split('-').map(Number);
    const deadlineDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
    if (isNaN(deadlineDate.getTime())) {
      alert('Invalid deadline.');
      return;
    }
    const deadlineTimestamp = Math.floor(deadlineDate.getTime() / 1000);
    if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
      alert('Deadline must be future.');
      return;
    }
    try {
      const gasEstimate = await crowdfunding.methods
        .createProject(title, description, fundingGoalWei, deadlineTimestamp)
        .estimateGas({ from: account });
      await crowdfunding.methods
        .createProject(title, description, fundingGoalWei, deadlineTimestamp)
        .send({ from: account, gas: gasEstimate });
      await new Promise(res => setTimeout(res, 500));
      await refreshProjects();
      setProjectForm({ title: '', description: '', fundingGoalUSD: '', deadline: '' });
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project.');
    }
  };

  const claimRewards = async () => {
    if (!referralRewards || !account) return;
    try {
      await referralRewards.methods.claimRewards().send({ from: account });
      alert('Rewards claimed!');
      await new Promise(res => setTimeout(res, 500));
      await refreshProjects();
    } catch (err) {
      console.error('Error claiming rewards:', err);
      alert('Error claiming rewards.');
    }
  };

  useEffect(() => {
    if (crowdfunding) {
      crowdfunding.events.ProjectCreated({}, async (error) => {
        if (!error) {
          await new Promise(res => setTimeout(res, 500));
          await refreshProjects();
        }
      });
      crowdfunding.events.Funded({}, async (error) => {
        if (!error) {
          await new Promise(res => setTimeout(res, 500));
          await refreshProjects();
        }
      });
      crowdfunding.events.FundsWithdrawn({}, async (error) => {
        if (!error) {
          await new Promise(res => setTimeout(res, 500));
          await refreshProjects();
        }
      });
    }
  }, [crowdfunding]);

  const myReferralLink = `http://localhost:3000/?ref=${account}`;

  return (
    <Container maxWidth="md">
      <Paper elevation={3} style={{ padding: '2rem', marginTop: '2rem' }}>
        <Typography variant="h3" align="center" gutterBottom>
          Decentralized Crowdfunding Platform
        </Typography>
        <Typography variant="h5" align="center" gutterBottom>
          Your Account: {userName || account}
        </Typography>

        {userName === 'No name registered' && (
          <Box display="flex" justifyContent="center" marginBottom="1rem">
            <Button variant="outlined" onClick={handleSetName}>
              Set My Name
            </Button>
          </Box>
        )}

        {account && referralRewards && (
          <Box mb={2}>
            <Typography variant="h6">Your Referral Link:</Typography>
            <Typography variant="body2">{myReferralLink}</Typography>
            <Typography variant="body2" style={{ marginTop: '0.5rem' }}>
              You have referred {myReferralCount} contributors.
            </Typography>
            <Typography variant="body2" style={{ marginTop: '0.5rem' }}>
              Your Referral Points: {myReferralPoints}
            </Typography>
            {myReferralPoints > 0 && (
              <Button variant="outlined" onClick={claimRewards} style={{ marginTop: '0.5rem' }}>
                Claim Reward
              </Button>
            )}
          </Box>
        )}

        <Grid container spacing={4}>
          <Grid item xs={12} sm={6}>
            <Typography variant="h5" gutterBottom>
              Create a New Project
            </Typography>
            <form onSubmit={createProject} className={classes.form}>
              <TextField
                label="Project Title"
                name="title"
                value={projectForm.title}
                onChange={handleInputChange}
                fullWidth
                required
                margin="normal"
                variant="outlined"
              />
              <TextField
                label="Project Description"
                name="description"
                value={projectForm.description}
                onChange={handleInputChange}
                fullWidth
                required
                margin="normal"
                multiline
                rows={4}
                variant="outlined"
              />
              <TextField
                label="Funding Goal (USD)"
                name="fundingGoalUSD"
                value={projectForm.fundingGoalUSD}
                onChange={handleInputChange}
                fullWidth
                required
                margin="normal"
                type="number"
                variant="outlined"
                InputProps={{
                  inputProps: { min: 0, step: 'any' },
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Project Deadline"
                name="deadline"
                value={projectForm.deadline}
                onChange={handleInputChange}
                fullWidth
                required
                margin="normal"
                type="date"
                variant="outlined"
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <Button
                variant="contained"
                color="primary"
                type="submit"
                style={{ marginTop: '1rem' }}
                fullWidth
              >
                Create Project
              </Button>
            </form>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="h5" gutterBottom>
              Available Projects
            </Typography>
            {projects.length > 0 ? (
              projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  account={account}
                  web3={web3}
                  multiSigApprover={multiSigApprover}
                  crowdfunding={crowdfunding}
                  topDonors={topDonors[project.id]}
                  refreshProjects={refreshProjects}
                  refParam={refParam}
                  referralRewards={referralRewards}
                />
              ))
            ) : (
              <Typography variant="body1">No projects available.</Typography>
            )}
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}

function ProjectCard({ project, account, web3, multiSigApprover, crowdfunding, topDonors, refreshProjects, refParam, referralRewards }) {
  const ETH_RATE_USD = 4000;
  const isTrustedSigner = TRUSTED_SIGNERS.some(s => s.toLowerCase() === account.toLowerCase());
  const isCreator = project.creator.toLowerCase() === account.toLowerCase();

  const fundingGoalETH = parseFloat(web3.utils.fromWei(project.fundingGoal, 'ether'));
  const totalFundsETH = parseFloat(web3.utils.fromWei(project.totalFunds, 'ether'));
  const milestonesClaimed = parseInt(project.milestonesClaimed);

  const g1 = fundingGoalETH / 3;
  const g2 = fundingGoalETH / 3;
  const g3 = fundingGoalETH - g1 - g2;

  let unlocked = 0;
  if (totalFundsETH >= g1) unlocked = 1;
  if (totalFundsETH >= g1+g2) unlocked = 2;
  if (totalFundsETH >= fundingGoalETH) unlocked = 3;

  const incrementsToWithdraw = (unlocked > milestonesClaimed) ? (unlocked - milestonesClaimed) : 0;

  const [alreadyApproved, setAlreadyApproved] = useState(false);
  const [allApproved, setAllApproved] = useState(false);

  useEffect(() => {
    const checkApprovals = async () => {
      if (!multiSigApprover || incrementsToWithdraw === 0) return;
      let globalApproved = true;
      let signerApprovedForAll = true;
      for (let m = milestonesClaimed; m < milestonesClaimed+incrementsToWithdraw; m++) {
        const milestoneIndex = m;
        const approved = await multiSigApprover.methods.isApprovedForMilestone(project.id, milestoneIndex).call();
        if (!approved) globalApproved = false;

        if (isTrustedSigner) {
          const signerApproved = await multiSigApprover.methods.milestoneApprovals(project.id, milestoneIndex, account).call();
          if (!signerApproved) signerApprovedForAll = false;
        }
      }

      setAllApproved(globalApproved);
      if (isTrustedSigner) {
        if (!globalApproved && !alreadyApproved) {
          if (signerApprovedForAll) setAlreadyApproved(true);
          else setAlreadyApproved(false);
        }

        if (globalApproved && isTrustedSigner) {
          let signerFullyApproved = true;
          for (let m = milestonesClaimed; m < milestonesClaimed+incrementsToWithdraw; m++) {
            const signerApproved = await multiSigApprover.methods.milestoneApprovals(project.id, m, account).call();
            if (!signerApproved) signerFullyApproved = false;
          }
          if (signerFullyApproved) setAlreadyApproved(true);
        }
      }
    };
    checkApprovals();
  }, [multiSigApprover, incrementsToWithdraw, project.id, milestonesClaimed, isTrustedSigner, account, alreadyApproved]);

  const approveMilestone = async () => {
    if (!multiSigApprover) return;
    try {
      for (let m = milestonesClaimed; m < milestonesClaimed+incrementsToWithdraw; m++) {
        const gasEstimate = await multiSigApprover.methods.approveWithdrawalForMilestone(project.id, m).estimateGas({ from: account });
        await multiSigApprover.methods.approveWithdrawalForMilestone(project.id, m).send({ from: account, gas: gasEstimate });
      }
      alert('Milestone(s) approved!');
      setAlreadyApproved(true);
      await new Promise(res => setTimeout(res, 500));
      await refreshProjects();
    } catch (error) {
      console.error('Error approving milestone:', error);
      alert('Error approving milestone. Check console.');
    }
  };

  const withdrawMilestoneFunds = async () => {
    try {
      const gasEstimate = await crowdfunding.methods.withdrawFunds(project.id).estimateGas({ from: account });
      await crowdfunding.methods.withdrawFunds(project.id).send({ from: account, gas: gasEstimate });
      alert('Milestone funds withdrawn successfully!');
      await new Promise(res => setTimeout(res, 500));
      await refreshProjects();
    } catch (error) {
      console.error('Error withdrawing milestone funds:', error);
      alert('Error withdrawing milestone funds. See console.');
    }
  };

  return (
    <Card style={{ marginBottom: '1rem', backgroundColor: '#f5f5f5' }}>
      <CardContent>
        <Typography variant="h6">{project.title}</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {project.description}
        </Typography>
        <Typography variant="body2">
          <strong>Creator:</strong> {project.creatorName}
        </Typography>
        <Typography variant="body2">
          <strong>Funding Goal:</strong>{' '}
          {`$${(fundingGoalETH * ETH_RATE_USD).toFixed(2)} USD`}
        </Typography>
        <Typography variant="body2">
          <strong>Total Funds:</strong>{' '}
          {`$${(totalFundsETH * ETH_RATE_USD).toFixed(2)} USD`}
        </Typography>
        <Typography variant="body2">
          <strong>Deadline:</strong>{' '}
          {new Date(Number(project.deadline) * 1000).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="error">
          {Number(project.deadline) * 1000 > Date.now()
            ? `${Math.ceil((Number(project.deadline) * 1000 - Date.now()) / (1000 * 60 * 60 * 24))} days remaining`
            : 'Deadline passed'}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={(totalFundsETH / fundingGoalETH) * 100}
          style={{ marginTop: '1rem' }}
        />
        {topDonors && topDonors.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <Typography variant="h6">Top Donors:</Typography>
            {topDonors.map((donor, index) => (
              <Box key={index} mb={1}>
                <Typography variant="body2">
                  {donor.name || donor.contributor}: $
                  {(parseFloat(web3.utils.fromWei(donor.amount, 'ether')) * ETH_RATE_USD).toFixed(2)} USD
                </Typography>
                {donor.comment && (
                  <Typography variant="body2" style={{ fontStyle: 'italic', color: '#555' }}>
                    "{donor.comment}"
                  </Typography>
                )}
              </Box>
            ))}
          </div>
        )}

        <Typography variant="body2" color="textSecondary">
          {project.isOpen ? 'Open for funding' : 'Funding closed'}
        </Typography>

        {project.isOpen && (
          <FundProject
            crowdfunding={crowdfunding}
            project={project}
            account={account}
            refreshProjects={refreshProjects}
            web3={web3}
            refParam={refParam}
            referralRewards={referralRewards}
          />
        )}

        {(incrementsToWithdraw > 0 && (isTrustedSigner || isCreator)) && (
          <Box mt={2}>
            <Typography variant="body2">
              {incrementsToWithdraw} increment(s) of funding are available to withdraw.
            </Typography>

            {!allApproved && isTrustedSigner && !alreadyApproved && (
              <Button variant="outlined" onClick={approveMilestone} style={{ marginTop: '0.5rem' }}>
                Approve Withdrawal
              </Button>
            )}

            {!allApproved && isTrustedSigner && alreadyApproved && (
              <Typography variant="body2" style={{ fontWeight: 'bold', marginTop: '0.5rem' }}>
                You have already approved this withdrawal.
              </Typography>
            )}

            {allApproved && isCreator && (
              <Button variant="contained" color="secondary" onClick={withdrawMilestoneFunds} style={{ marginTop: '0.5rem' }}>
                Withdraw Now
              </Button>
            )}
          </Box>
        )}

      </CardContent>
    </Card>
  );
}

function FundProject({ crowdfunding, project, account, refreshProjects, web3, refParam, referralRewards }) {
  const [amountUSD, setAmountUSD] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const fund = async () => {
    if (!amountUSD || parseFloat(amountUSD) <= 0) {
      setError('Please enter a valid funding amount in USD.');
      return;
    }
    const ethValue = parseFloat(amountUSD) / 4000;
    const ethValueWei = web3.utils.toWei(ethValue.toString(), 'ether');
    try {
      const gasEstimate = await crowdfunding.methods
        .fundProject(project.id, comment)
        .estimateGas({ from: account, value: ethValueWei });
      await crowdfunding.methods
        .fundProject(project.id, comment)
        .send({ from: account, value: ethValueWei, gas: gasEstimate });

      setAmountUSD('');
      setComment('');
      setError('');
      await new Promise(res => setTimeout(res, 500));
      await refreshProjects();

      // Record referral if applicable
      if (refParam && referralRewards && refParam.toLowerCase() !== account.toLowerCase()) {
        try {
          const gasEstimateRef = await referralRewards.methods.recordReferral(account, refParam).estimateGas({ from: account });
          await referralRewards.methods.recordReferral(account, refParam).send({ from: account, gas: gasEstimateRef });
          alert('Referral recorded!');
          await new Promise(res => setTimeout(res, 500));
          // Optionally refresh referral data after referral recorded
        } catch (err) {
          console.error('Error recording referral:', err);
        }
      }

    } catch (error) {
      console.error('Error funding project:', error);
      alert('Error funding project. See console.');
    }
  };

  return (
    <Box style={{ marginTop: '1rem' }}>
      <TextField
        label="Amount to Fund (USD)"
        value={amountUSD}
        onChange={(e) => setAmountUSD(e.target.value)}
        fullWidth
        required
        margin="normal"
        type="number"
        variant="outlined"
        InputProps={{
          inputProps: { min: 0, step: 'any' },
          startAdornment: <InputAdornment position="start">$</InputAdornment>,
        }}
        error={!!error}
        helperText={error}
      />
      <TextField
        label="Comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        fullWidth
        margin="normal"
        multiline
        rows={4}
        placeholder="Words of support"
        variant="outlined"
      />
      <Button
        variant="contained"
        color="primary"
        onClick={fund}
        fullWidth
        style={{ marginTop: '1rem' }}
      >
        Fund Project
      </Button>
    </Box>
  );
}

export default App;
