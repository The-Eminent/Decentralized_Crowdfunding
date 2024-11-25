import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import Crowdfunding from './contracts/Crowdfunding.json';
// import './App.css';


// Import Material-UI components
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import { makeStyles } from '@mui/styles';

// Custom styles using makeStyles
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
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    fundingGoal: '',
  });

  useEffect(() => {
    const init = async () => {
      // Check if MetaMask is available
      if (window.ethereum) {
        try {
          // Request account access
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          // Get network ID
          const networkId = await web3Instance.eth.net.getId();
          const deployedNetwork = Crowdfunding.networks[networkId];

          if (!deployedNetwork) {
            alert('Smart contract not deployed on the current network. Please switch networks in MetaMask.');
            return;
          }

          // Create contract instance
          const instance = new web3Instance.eth.Contract(
            Crowdfunding.abi,
            deployedNetwork.address
          );
          setCrowdfunding(instance);

          // Get user accounts
          const accounts = await web3Instance.eth.getAccounts();
          if (accounts.length === 0) {
            alert('No accounts found. Please connect your MetaMask account.');
            return;
          }
          setAccount(accounts[0]);

          // Load existing projects
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

  const handleInputChange = (e) => {
    setProjectForm({
      ...projectForm,
      [e.target.name]: e.target.value,
    });
  };

  const createProject = async (e) => {
    e.preventDefault();
    const { title, description, fundingGoal } = projectForm;

    // Input validation
    if (!title || !description || !fundingGoal || parseFloat(fundingGoal) <= 0) {
      alert('Please enter valid project details.');
      return;
    }

    try {
      await crowdfunding.methods
        .createProject(
          title,
          description,
          web3.utils.toWei(fundingGoal, 'ether')
        )
        .send({ from: account });
      // Reset form fields
      setProjectForm({ title: '', description: '', fundingGoal: '' });
      // Refresh projects list
      loadProjects(crowdfunding);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project. See console for details.');
    }
  };

  const withdrawFunds = async (projectId) => {
    try {
      await crowdfunding.methods.withdrawFunds(projectId).send({ from: account });
      // Refresh projects list
      loadProjects(crowdfunding);
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      alert('Error withdrawing funds. See console for details.');
    }
  };

  // Event listeners for real-time updates
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
        {/* Project Creation Form */}
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
            <Button variant="contained" color="primary" type="submit" style={{ marginTop: '1rem' }}>
              Create Project
            </Button>
          </form>
        </Grid>

        {/* Available Projects */}
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
                  <LinearProgress
                    variant="determinate"
                    value={
                      (parseFloat(web3.utils.fromWei(project.totalFunds, 'ether')) /
                        parseFloat(web3.utils.fromWei(project.fundingGoal, 'ether'))) *
                      100
                    }
                    style={{ marginTop: '1rem' }}
                  />
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

  const fund = async () => {
    // Input validation
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid funding amount.');
      return;
    }

    try {
      await crowdfunding.methods
        .fundProject(project.id)
        .send({
          from: account,
          value: web3.utils.toWei(amount, 'ether'),
        });
      // Reset amount field
      setAmount('');
      // Refresh projects list
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
      <Button variant="contained" color="primary" onClick={fund}>
        Fund Project
      </Button>
    </div>
  );
}

export default App;
