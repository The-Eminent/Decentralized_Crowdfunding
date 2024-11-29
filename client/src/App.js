import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import Crowdfunding from './contracts/Crowdfunding.json';
import { Container, Typography, TextField, Button, Grid, Card, CardContent, InputAdornment, LinearProgress } from '@mui/material';
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles({
  form: {
    marginTop: '2rem',
  },
  projectCard: {
    marginBottom: '1rem',
  },
  fundInput: {
    marginTop: '1rem',
  },
});

function App() {
  const classes = useStyles();
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState('');
  const [crowdfunding, setCrowdfunding] = useState(null);
  const [projects, setProjects] = useState([]);
  // const [userName, setUserName] = useState('');
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    fundingGoal: '',
    deadline: '',
  });

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          const networkId = await web3Instance.eth.net.getId();
          const deployedNetwork = Crowdfunding.networks[networkId];
          if (!deployedNetwork) {
            alert('Smart contract not deployed on the current network. Please switch networks in MetaMask.');
            return;
          }

          const instance = new web3Instance.eth.Contract(
            Crowdfunding.abi,
            deployedNetwork.address
          );
          setCrowdfunding(instance);

          const accounts = await web3Instance.eth.getAccounts();
          if (accounts.length === 0) {
            alert('No accounts found. Please connect your MetaMask account.');
            return;
          }
          setAccount(accounts[0]);

          loadProjects(instance);
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

  const loadProjects = async (contractInstance) => {
    const projectCount = await contractInstance.methods.projectCount().call();
    const projectsList = [];
    for (let i = 1; i <= projectCount; i++) {
      const project = await contractInstance.methods.projects(i).call();
      projectsList.push(project);
    }
    setProjects(projectsList);
  };

  const [topDonors, setTopDonors] = useState([]);
  useEffect(() => {
    const loadTopDonors = (projectId) => {
    crowdfunding.methods.getDonations(projectId).call().then((donations) => {
      // Sort donations by amount (descending order)
      donations.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
      setTopDonors((prevDonors) => ({
        ...prevDonors,
        [projectId]: donations.slice(0, 3), // Store top 3 donors for each project
      }));
    });
  };
  
    if (projects.length > 0) {
      projects.forEach((project) => {
        loadTopDonors(project.id);
      });
    }
  }, [projects, crowdfunding]);

  // const loadTopDonors = (projectId) => {
  //   crowdfunding.methods.getDonations(projectId).call().then((donations) => {
  //     // Sort donations by amount (descending order)
  //     donations.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
  //     setTopDonors((prevDonors) => ({
  //       ...prevDonors,
  //       [projectId]: donations.slice(0, 3), // Store top 3 donors for each project
  //     }));
  //   });
  // };

  
  // useEffect(() => {
  //   if (projects.length > 0) {
  //     projects.forEach((project) => {
  //       loadTopDonors(project.id);
  //     });
  //   }
  // }, [projects]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProjectForm((prevForm) => ({
      ...prevForm,
      [name]: value,
    }));
  };

  const createProject = async (e) => {
    e.preventDefault();
    const { title, description, fundingGoal, deadline } = projectForm;
    if (!title || !description || !fundingGoal || !deadline) {
      alert('All fields are required.');
      return;
    }

    const fundingGoalNumber = parseFloat(fundingGoal);
    if (isNaN(fundingGoalNumber) || fundingGoalNumber <= 0) {
      alert('Funding goal must be a positive number.');
      return;
    }

    const fundingGoalWei = web3.utils.toWei(fundingGoalNumber.toString(), 'ether');

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
        .createProject(
          title,
          description,
          fundingGoalWei,
          deadlineTimestamp
        )
        .estimateGas({ from: account });

      await crowdfunding.methods
        .createProject(
          title,
          description,
          fundingGoalWei,
          deadlineTimestamp
        )
        .send({ from: account, gas: gasEstimate });

      setProjectForm({
        title: '',
        description: '',
        fundingGoal: '',
        deadline: '',
      });
      loadProjects(crowdfunding);
    } catch (error) {
      console.error('Error creating project:', error);
      const revertReason = error?.data?.message || error.message || 'Transaction reverted';
      alert(`Error creating project: ${revertReason}`);
    }
  };

  const withdrawFunds = async (projectId) => {
    try {
      await crowdfunding.methods.withdrawFunds(projectId).send({ from: account });
      loadProjects(crowdfunding);
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      alert('Error withdrawing funds. See console for details.');
    }
  };

  useEffect(() => {
    if (crowdfunding) {
      crowdfunding.events.ProjectCreated({}, (error) => {
        if (error) {
          console.error('Error in ProjectCreated event listener:', error);
        } else {
          loadProjects(crowdfunding);
        }
      });
      crowdfunding.events.Funded({}, (error) => {
        if (error) {
          console.error('Error in Funded event listener:', error);
        } else {
          loadProjects(crowdfunding);
        }
      });
      crowdfunding.events.FundsWithdrawn({}, (error) => {
        if (error) {
          console.error('Error in FundsWithdrawn event listener:', error);
        } else {
          loadProjects(crowdfunding);
        }
      });
    }
  }, [crowdfunding]);

  return (
    <Container maxWidth="md">
      <Typography variant="h3" align="center" gutterBottom style={{ marginTop: '2rem' }}>
        Decentralized Crowdfunding Platform
      </Typography>
      <Typography variant="subtitle1" align="center" gutterBottom>
        Your account: {account}
      </Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} sm={6}>
          <Typography variant="h5">Create a New Project</Typography>
          <form onSubmit={createProject} className={classes.form}>
            <TextField
              label="Project Title"
              name="title"
              value={projectForm.title}
              onChange={handleInputChange}
              fullWidth
              required
              margin="normal"
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
            />
            <TextField
              label="Funding Goal (ETH)"
              name="fundingGoal"
              value={projectForm.fundingGoal}
              onChange={handleInputChange}
              fullWidth
              required
              margin="normal"
              type="number"
              InputProps={{
                inputProps: { min: 0, step: 'any' },
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
              InputLabelProps={{
                shrink: true,
              }}
            />
            <Button variant="contained" color="primary" type="submit" style={{ marginTop: '1rem' }}>
              Create Project
            </Button>
          </form>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="h5">Available Projects</Typography>
          {projects.length > 0 ? (
            projects.map((project) => (
              <Card key={project.id} className={classes.projectCard}>
                <CardContent>
                  <Typography variant="h6">{project.title}</Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {project.description}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Funding Goal:</strong>{' '}
                    {web3 && web3.utils.fromWei(project.fundingGoal, 'ether')} ETH
                  </Typography>
                  <Typography variant="body2">
                    <strong>Total Funds:</strong>{' '}
                    {web3 && web3.utils.fromWei(project.totalFunds, 'ether')} ETH
                  </Typography>
                  <Typography variant="body2">
                    <strong>Deadline:</strong> {new Date(Number(project.deadline) * 1000).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="error">
                    {Number(project.deadline) * 1000 > Date.now()
                      ? `${Math.ceil((Number(project.deadline) * 1000 - Date.now()) / (1000 * 60 * 60 * 24))} days remaining`
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
                  {/* Show top donors for this project */}
                  {topDonors[project.id] && topDonors[project.id].length > 0 && (
                    <div>
                      <Typography variant="h6">Top Donors:</Typography>
                      {topDonors[project.id].map((donor, index) => (
                        <Typography key={index} variant="body2">
                          {donor.contributor}: {web3.utils.fromWei(donor.amount, 'ether')} ETH
                        </Typography>
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
                      refreshProjects={() => loadProjects(crowdfunding)}
                      web3={web3}
                    />
                  )}
                  {project.isOpen &&
                    project.creator.toLowerCase() === account.toLowerCase() &&
                    parseFloat(web3.utils.fromWei(project.totalFunds, 'ether')) >=
                      parseFloat(web3.utils.fromWei(project.fundingGoal, 'ether')) && (
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
    </Container>
  );
}

function FundProject({ crowdfunding, project, account, refreshProjects, web3 }) {
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');

  const fund = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid funding amount.');
      return;
    }
    try {
      await crowdfunding.methods
        .fundProject(project.id, comment)
        .send({ from: account, value: web3.utils.toWei(amount, 'ether') });
      setAmount('');
      setComment('');
      refreshProjects();
    } catch (error) {
      console.error('Error funding project:', error);
      alert('Error funding project. See console for details.');
    }
  };

  return (
    <div className="fund-input">
      <TextField
        label="Amount to Fund (ETH)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        fullWidth
        required
        margin="normal"
        type="number"
        InputProps={{
          inputProps: { min: 0, step: 'any' },
          endAdornment: <InputAdornment position="end">ETH</InputAdornment>,
        }}
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
      />
      <Button variant="contained" color="primary" onClick={fund}>
        Fund Project
      </Button>
    </div>
  );
}

export default App;