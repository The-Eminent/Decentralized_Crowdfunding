import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import Crowdfunding from './contracts/Crowdfunding.json';
import NameRegistryABI from './contracts/NameRegistry.json';
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
import axios from 'axios'; // Removed axios usage for ETH rate fetching

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

// Define a fixed ETH rate for the session (e.g., 2000 USD per ETH)
const ETH_RATE_USD = 2000; // You can adjust this value as needed

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

  // Initialize Web3 and connect to contracts
  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          // Request account access if needed
          await window.ethereum.request({ method: 'eth_requestAccounts' });

          // We don't need to fetch ETH rate anymore
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          const networkId = await web3Instance.eth.net.getId();
          const deployedNetwork = Crowdfunding.networks[networkId];
          if (!deployedNetwork) {
            alert(
              'Crowdfunding contract not deployed on the current network. Please switch networks in MetaMask.'
            );
            return;
          }

          const crowdfundingInstance = new web3Instance.eth.Contract(
            Crowdfunding.abi,
            deployedNetwork.address
          );
          setCrowdfunding(crowdfundingInstance);

          const accounts = await web3Instance.eth.getAccounts();
          if (accounts.length === 0) {
            alert('No accounts found. Please connect your MetaMask account.');
            return;
          }
          setAccount(accounts[0]);

          // Interact with NameRegistry contract
          const nameRegistryNetwork = NameRegistryABI.networks[networkId];
          if (!nameRegistryNetwork) {
            alert('NameRegistry contract not deployed on the current network.');
            return;
          }

          const nameRegistryInstance = new web3Instance.eth.Contract(
            NameRegistryABI.abi,
            nameRegistryNetwork.address
          );
          setNameRegistry(nameRegistryInstance);

          // Fetch the name linked to the user's address
          const storedName = await nameRegistryInstance.methods
            .getName(accounts[0])
            .call();
          setUserName(storedName || 'No name registered');
        } catch (error) {
          console.error('Error connecting to MetaMask:', error);
          alert('Could not connect to MetaMask. See console for details.');
        }
      } else {
        alert('MetaMask is not installed. Please install it to use this app.');
      }
    };
    init();
  }, []);

  // Load all projects once contracts are initialized
  useEffect(() => {
    if (crowdfunding && nameRegistry) {
      loadProjects();
    }
  }, [crowdfunding, nameRegistry]);

  // Function to load all projects
  const loadProjects = async () => {
    try {
      const projectCount = await crowdfunding.methods.projectCount().call();
      const projectsList = [];

      for (let i = 1; i <= projectCount; i++) {
        const project = await crowdfunding.methods.projects(i).call();

        // Fetch the creator's name from the NameRegistry contract
        const creatorName = await nameRegistry.methods
          .getName(project.creator)
          .call();
        project.creatorName = creatorName || project.creator; // Use name or fallback to address

        projectsList.push(project);
      }

      setProjects(projectsList);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Load top donors for each project
  useEffect(() => {
    const loadTopDonors = async (projectId) => {
      try {
        const donations = await crowdfunding.methods.getDonations(projectId).call();

        // Sort donations by amount (descending order)
        donations.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

        // Take top 3 donors
        const topThree = donations.slice(0, 3).map((d) => ({
          ...d,
          projectId,
        }));

        // Fetch donor names
        const donorsWithNames = await Promise.all(
          topThree.map(async (donor) => {
            const donorName = await nameRegistry.methods.getName(donor.contributor).call();
            return {
              ...donor,
              name: donorName || donor.contributor, // Fallback to address if no name
            };
          })
        );

        setTopDonors((prevState) => ({
          ...prevState,
          [projectId]: donorsWithNames,
        }));
      } catch (error) {
        console.error('Error loading top donors:', error);
      }
    };

    if (projects.length > 0) {
      projects.forEach((project) => {
        loadTopDonors(project.id);
      });
    }
  }, [projects, crowdfunding, nameRegistry]);

  // Handle input changes for project creation form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProjectForm((prevForm) => ({
      ...prevForm,
      [name]: value,
    }));
  };

  // Function to check if the chosen username is unique
  const isNameTaken = (name) => {
    // Check all project creators
    for (let proj of projects) {
      if (proj.creatorName === name) return true;
    }

    // Check top donors
    for (let pid in topDonors) {
      for (let donor of topDonors[pid]) {
        if (donor.name === name) return true;
      }
    }

    return false;
  };

  // Handle setting the user's name
  const handleSetName = async () => {
    if (!nameRegistry || !account) {
      console.error('nameRegistry or account not ready');
      return;
    }

    if (!userName || userName === 'No name registered') {
      const name = prompt('Enter your name:');
      if (name) {
        // Check uniqueness
        if (isNameTaken(name)) {
          alert('This username is already taken. Please choose another name.');
          return;
        }

        try {
          await nameRegistry.methods.registerName(name).send({ from: account });
          setUserName(name); // Update frontend state
        } catch (error) {
          console.error('Error registering name:', error);
          alert('Failed to register name on the blockchain.');
        }
      }
    }
  };

  // Handle project creation
  const createProject = async (e) => {
    e.preventDefault();
    if (!crowdfunding || !web3 || !account) {
      console.error('crowdfunding, web3 or account is not ready');
      return;
    }

    // Ensure the user has set a name
    if (userName === 'No name registered') {
      alert('Please set your name first before creating a project.');
      return;
    }

    const { title, description, fundingGoalUSD, deadline } = projectForm;
    if (!title || !description || !fundingGoalUSD || !deadline) {
      alert('All fields are required.');
      return;
    }

    const fundingGoalUSDNumber = parseFloat(fundingGoalUSD);
    if (isNaN(fundingGoalUSDNumber) || fundingGoalUSDNumber <= 0) {
      alert('Funding goal must be a positive number.');
      return;
    }

    // Convert USD to ETH using the fixed rate
    const fundingGoalETH = fundingGoalUSDNumber / ETH_RATE_USD;
    const fundingGoalWei = web3.utils.toWei(fundingGoalETH.toString(), 'ether');

    // Convert deadline to timestamp
    const [year, month, day] = deadline.split('-').map(Number);
    const deadlineDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
    if (isNaN(deadlineDate.getTime())) {
      alert('Invalid deadline date.');
      return;
    }
    const deadlineTimestamp = Math.floor(deadlineDate.getTime() / 1000);

    if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
      alert('Deadline must be in the future.');
      return;
    }

    try {
      const gasEstimate = await crowdfunding.methods
        .createProject(title, description, fundingGoalWei, deadlineTimestamp)
        .estimateGas({ from: account });

      await crowdfunding.methods
        .createProject(title, description, fundingGoalWei, deadlineTimestamp)
        .send({ from: account, gas: gasEstimate });

      setProjectForm({
        title: '',
        description: '',
        fundingGoalUSD: '',
        deadline: '',
      });
      loadProjects(); // Reload projects after creation
    } catch (error) {
      console.error('Error creating project:', error);
      const revertReason =
        error?.data?.message || error.message || 'Transaction reverted';
      alert(`Error creating project: ${revertReason}`);
    }
  };

  // Handle withdrawing funds from a project
  const withdrawFunds = async (projectId) => {
    if (!crowdfunding || !account) {
      console.error('crowdfunding or account is not ready');
      return;
    }
    try {
      await crowdfunding.methods.withdrawFunds(projectId).send({ from: account });
      loadProjects(); // Reload projects after withdrawal
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      alert('Error withdrawing funds. See console for details.');
    }
  };

  // Listen to smart contract events to update UI in real-time
  useEffect(() => {
    if (crowdfunding) {
      // ProjectCreated event
      crowdfunding.events.ProjectCreated({}, (error) => {
        if (error) {
          console.error('Error in ProjectCreated event listener:', error);
        } else {
          loadProjects();
        }
      });

      // Funded event
      crowdfunding.events.Funded({}, (error) => {
        if (error) {
          console.error('Error in Funded event listener:', error);
        } else {
          loadProjects();
        }
      });

      // FundsWithdrawn event
      crowdfunding.events.FundsWithdrawn({}, (error) => {
        if (error) {
          console.error('Error in FundsWithdrawn event listener:', error);
        } else {
          loadProjects();
        }
      });
    }
  }, [crowdfunding]);

  return (
    <Container maxWidth="md">
      <Paper elevation={3} style={{ padding: '2rem', marginTop: '2rem' }}>
        <Typography variant="h3" align="center" gutterBottom>
          Decentralized Crowdfunding Platform
        </Typography>
        {/* Display user's name or account address */}
        <Typography variant="h5" align="center" gutterBottom>
          Your Account: {userName || account}
        </Typography>

        {/* Show the "Set My Name" button only if the user hasn't set a name */}
        {userName === 'No name registered' && (
          <Box display="flex" justifyContent="center" marginBottom="1rem">
            <Button variant="outlined" onClick={handleSetName}>
              Set My Name
            </Button>
          </Box>
        )}

        <Grid container spacing={4}>
          {/* Project Creation Form */}
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

          {/* Display Available Projects */}
          <Grid item xs={12} sm={6}>
            <Typography variant="h5" gutterBottom>
              Available Projects
            </Typography>
            {projects.length > 0 ? (
              projects.map((project) => (
                <Card key={project.id} className={classes.projectCard}>
                  <CardContent>
                    <Typography variant="h6">{project.title}</Typography>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      gutterBottom
                    >
                      {project.description}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Creator:</strong> {project.creatorName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Funding Goal:</strong>{' '}
                      {`$${(
                        (parseFloat(web3.utils.fromWei(project.fundingGoal, 'ether')) *
                          ETH_RATE_USD
                        ).toFixed(2)
                      )} USD`}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Total Funds:</strong>{' '}
                      {`$${(
                        (parseFloat(web3.utils.fromWei(project.totalFunds, 'ether')) *
                          ETH_RATE_USD
                        ).toFixed(2)
                      )} USD`}
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
                    {/* Display Top Donors */}
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
                              <Typography
                                variant="body2"
                                className={classes.comment}
                              >
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
                    {/* Fund Project Component */}
                    {project.isOpen && (
                      <FundProject
                        crowdfunding={crowdfunding}
                        project={project}
                        account={account}
                        refreshProjects={loadProjects}
                        web3={web3}
                      />
                    )}
                    {/* Withdraw Funds Button */}
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

// FundProject Component
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

    // Convert USD to ETH using the fixed rate
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
      alert('Error funding project. See console for details.');
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

export default App;
