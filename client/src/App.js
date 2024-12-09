import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import Crowdfunding from './contracts/Crowdfunding.json';
import NameRegistryABI from './contracts/NameRegistry.json';
import MultiSigApproverABI from './contracts/MultiSigApprover.json'; 
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

// Fixed ETH rate for session
const ETH_RATE_USD = 4000; 

// Trusted signers array used when deploying MultiSigApprover
const TRUSTED_SIGNERS = [
  "0x1503a1347bFCD038BB750CCfEde703CD3ACd4B55",
  "0x3D74170eD20891004646C2b4C174B93B3c5C7191"
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

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          const networkId = await web3Instance.eth.net.getId();
          const crowdfundingInstance = new web3Instance.eth.Contract(
            Crowdfunding.abi,
            config.crowdfunding
          );
          setCrowdfunding(crowdfundingInstance);

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

          if (config.multiSigApprover) {
            const multiSigInstance = new web3Instance.eth.Contract(
              MultiSigApproverABI.abi,
              config.multiSigApprover
            );
            setMultiSigApprover(multiSigInstance);
          }

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

  useEffect(() => {
    if (crowdfunding && nameRegistry) {
      loadProjects();
    }
  }, [crowdfunding, nameRegistry]);

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

  // Fetch approval status for each project
  useEffect(() => {
    const fetchApprovalStatus = async () => {
      if (!crowdfunding || !multiSigApprover) return;
      try {
        const updatedProjects = await Promise.all(
          projects.map(async (project) => {
            try {
              const result = await crowdfunding.methods
                .getApprovalStatus(project.id)
                .call();
              const approvedCount = parseInt(result[0], 10);
              const requiredApprovals = parseInt(result[1], 10);
  
              return {
                ...project,
                approvalStatus: {
                  approved: approvedCount,
                  required: requiredApprovals
                }
              };
            } catch (err) {
              console.error("Error fetching approval status:", err);
              return project;
            }
          })
        );
        setProjects(updatedProjects);
      } catch (error) {
        console.error("Error fetching approval status:", error);
      }
    };
  
    if (projects.length > 0 && multiSigApprover) {
      fetchApprovalStatus();
    }
  }, [projects, multiSigApprover, crowdfunding]);
  

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
    if (!nameRegistry || !account) {
      console.error('nameRegistry or account not ready');
      return;
    }
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
      setProjectForm({ title: '', description: '', fundingGoalUSD: '', deadline: '' });
      loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project.');
    }
  };

  const withdrawFunds = async (projectId) => {
    if (!crowdfunding || !account) return;
    try {
      const result = await crowdfunding.methods.getApprovalStatus(projectId).call();
      const approvedCount = result['0'];
      const requiredApprovals = result['1'];

      if (parseInt(approvedCount) < parseInt(requiredApprovals)) {
        alert(`Withdrawal not allowed. Only ${approvedCount}/${requiredApprovals} approved.`);
        return;
      }

      await crowdfunding.methods.withdrawFunds(projectId).send({ from: account });
      loadProjects();
      alert('Funds withdrawn successfully!');
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      alert('Error withdrawing funds.');
    }
  };

  useEffect(() => {
    if (crowdfunding) {
      crowdfunding.events.ProjectCreated({}, (error) => {
        if (!error) loadProjects();
      });
      crowdfunding.events.Funded({}, (error) => {
        if (!error) loadProjects();
      });
      crowdfunding.events.FundsWithdrawn({}, (error) => {
        if (!error) loadProjects();
      });
    }
  }, [crowdfunding]);

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
                <Card key={project.id} className={classes.projectCard}>
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
                      {`$${(
                        parseFloat(web3.utils.fromWei(project.fundingGoal, 'ether')) *
                        ETH_RATE_USD
                      ).toFixed(2)} USD`}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Total Funds:</strong>{' '}
                      {`$${(
                        parseFloat(web3.utils.fromWei(project.totalFunds, 'ether')) *
                        ETH_RATE_USD
                      ).toFixed(2)} USD`}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Deadline:</strong>{' '}
                      {new Date(Number(project.deadline) * 1000).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="error">
                      {Number(project.deadline) * 1000 > Date.now()
                        ? `${Math.ceil(
                            (Number(project.deadline) * 1000 - Date.now()) /
                            (1000 * 60 * 60 * 24)
                          )} days remaining`
                        : 'Deadline passed'}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={
                        (parseFloat(web3.utils.fromWei(project.totalFunds, 'ether')) /
                          parseFloat(web3.utils.fromWei(project.fundingGoal, 'ether'))) *
                        100
                      }
                      style={{ marginTop: '1rem' }}
                    />
                    {topDonors[project.id] && topDonors[project.id].length > 0 && (
                      <div className={classes.topDonors}>
                        <Typography variant="h6">Top Donors:</Typography>
                        {topDonors[project.id].map((donor, index) => (
                          <Box key={index} mb={1}>
                            <Typography variant="body2">
                              {donor.name || donor.contributor}: $
                              {(
                                parseFloat(web3.utils.fromWei(donor.amount, 'ether')) *
                                ETH_RATE_USD
                              ).toFixed(2)}{' '}
                              USD
                            </Typography>
                            {donor.comment && (
                              <Typography variant="body2" className={classes.comment}>
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

                    {/* Show Approval Status if closed and multiSigApprover set */}
                    {!project.isOpen && multiSigApprover && project.approvalStatus && (
                      <Box mt={2}>
                        <Typography variant="body2">
                          Approval Status: {project.approvalStatus.approved}/{project.approvalStatus.required}
                        </Typography>
                      </Box>
                    )}

                    {project.isOpen && (
                      <FundProject
                        crowdfunding={crowdfunding}
                        project={project}
                        account={account}
                        refreshProjects={loadProjects}
                        web3={web3}
                      />
                    )}
                    {!project.isOpen &&
                      project.creator.toLowerCase() === account.toLowerCase() &&
                      parseFloat(web3.utils.fromWei(project.totalFunds, 'ether')) > 0 && (
                        <Button
                          onClick={() => withdrawFunds(project.id)}
                          variant="contained"
                          color="secondary"
                          sx={{ mt: 2 }}
                        >
                          Withdraw Funds
                        </Button>
                      )}

                    <ApproveWithdrawalButton
                      project={project}
                      account={account}
                      multiSigApprover={multiSigApprover}
                      refreshProjects={loadProjects}
                      web3={web3}
                    />
                  </CardContent>
                </Card>
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

function FundProject({ crowdfunding, project, account, refreshProjects, web3 }) {
  const classes = useStyles();
  const [amountUSD, setAmountUSD] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const fund = async () => {
    if (!amountUSD || parseFloat(amountUSD) <= 0) {
      setError('Please enter a valid funding amount in USD.');
      return;
    }
    const ethValue = parseFloat(amountUSD) / ETH_RATE_USD;
    const ethValueWei = web3.utils.toWei(ethValue.toString(), 'ether');
    try {
      await crowdfunding.methods
        .fundProject(project.id, comment)
        .send({ from: account, value: ethValueWei });
      setAmountUSD('');
      setComment('');
      setError('');
      refreshProjects();
    } catch (error) {
      console.error('Error funding project:', error);
      alert('Error funding project. See console.');
    }
  };

  return (
    <Box className={classes.fundInput}>
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

function ApproveWithdrawalButton({ project, account, multiSigApprover, refreshProjects, web3 }) {
  const isTrustedSigner = TRUSTED_SIGNERS.some(s => s.toLowerCase() === account.toLowerCase());
  const [alreadyApproved, setAlreadyApproved] = useState(false);

  useEffect(() => {
    const checkApproval = async () => {
      if (!multiSigApprover || !isTrustedSigner) return;
      try {
        const didApprove = await multiSigApprover.methods.approvals(project.id, account).call();
        setAlreadyApproved(didApprove);
      } catch (error) {
        console.error("Error checking approval:", error);
      }
    };
    checkApproval();
  }, [multiSigApprover, isTrustedSigner, project.id, account]);

  const approve = async () => {
    if (!multiSigApprover) {
      alert('MultiSigApprover not set or not ready.');
      return;
    }
    try {
      await multiSigApprover.methods.approveWithdrawal(project.id).send({ from: account });
      refreshProjects();
      alert('Withdrawal approved!');
      setAlreadyApproved(true);
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      alert('Error approving withdrawal. Check console.');
    }
  };

  const totalFundsEth = parseFloat(web3.utils.fromWei(project.totalFunds, 'ether'));

  if (!project.isOpen && totalFundsEth > 0 && isTrustedSigner) {
    return (
      <Box mt={2}>
        {!alreadyApproved ? (
          <>
            <Typography variant="body2">
              You are a trusted signer. Please approve withdrawal if you agree the creator can withdraw.
            </Typography>
            <Button variant="outlined" onClick={approve}>
              Approve Withdrawal
            </Button>
          </>
        ) : (
          <Typography variant="body2" style={{ fontWeight: 'bold' }}>
            You have already approved this withdrawal.
          </Typography>
        )}
      </Box>
    );
  }
  return null;
}

export default App;
