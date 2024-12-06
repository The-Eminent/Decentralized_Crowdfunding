import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import Crowdfunding from './contracts/Crowdfunding.json';
import NameRegistryABI from './contracts/NameRegistry.json';
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
  const [topDonors, setTopDonors] = useState([]);
  const [userName, setUserName] = useState('');
  const [nameRegistry, setNameRegistry] = useState(null);
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

          // Interact with NameRegistry contract
          const nameRegistryNetwork = NameRegistryABI.networks[networkId];
          if (!nameRegistryNetwork) {
            alert('NameRegistry contract not deployed on the current network.');
            return;
          }

          const nameRegistryInstance = new web3Instance.eth.Contract(
            NameRegistryABI.abi, // Ensure ABI is correctly used
            nameRegistryNetwork.address
          );
          setNameRegistry(nameRegistryInstance);

          // Fetch the ENS name or custom name linked to the user's address
          const storedName = await nameRegistryInstance.methods.getName(accounts[0]).call();
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

  useEffect(() => {
    if (crowdfunding && nameRegistry) {
      loadProjects(crowdfunding);
    }
  }, [crowdfunding, nameRegistry]); // Load projects after both contracts are initialized

  // last working 
  // const loadProjects = async (contractInstance) => {
  //   const projectCount = await contractInstance.methods.projectCount().call();
  //   const projectsList = [];
  //   for (let i = 1; i <= projectCount; i++) {
  //     const project = await contractInstance.methods.projects(i).call();
  //     projectsList.push(project);
  //   }
  //   setProjects(projectsList);
  // };

  const loadProjects = async (contractInstance) => {
    if (!contractInstance || !nameRegistry) {
      console.error('Contract instances not ready yet');
      return;
    }

    const projectCount = await contractInstance.methods.projectCount().call();
    const projectsList = [];

    for (let i = 1; i <= projectCount; i++) {
      const project = await contractInstance.methods.projects(i).call();

      // Added: close project if deadline passed
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime > project.deadline) {
        project.isOpen = false;
      }

      // Fetch the creator's name from the NameRegistry contract
      const creatorName = await nameRegistry.methods.getName(project.creator).call();
      project.creatorName = creatorName || project.creator; // Use name or fallback to address

      projectsList.push(project);
    }

    setProjects(projectsList);
  };


  // const getDonorsNames = async () => {
  //   const donors = await getTopDonors(); // Fetch donors (you already have this logic)

  //   for (const donor of donors) {
  //     const donorName = await nameRegistry.methods.getName(donor.address).call();
  //     donor.name = donorName || donor.address; // Use name or fallback to address
  //   }

  //   setTopDonors(donors);
  // };


  // useEffect(() => {
  //   const loadTopDonors = (projectId) => {
  //     crowdfunding.methods.getDonations(projectId).call().then((donations) => {
  //       // Sort donations by amount (descending order)
  //       donations.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
  //       setTopDonors((prevDonors) => ({
  //         ...prevDonors,
  //         [projectId]: donations.slice(0, 3), // Store top 3 donors for each project
  //       }));
  //     });
  //   };

  //   if (projects.length > 0) {
  //     projects.forEach((project) => {
  //       loadTopDonors(project.id);
  //     });
  //   }
  // }, [projects, crowdfunding]);



  useEffect(() => {
    const loadTopDonors = async (projectId) => {
      try {
        if (!crowdfunding || !nameRegistry) {
          console.error('Contracts not ready yet to load top donors');
          return;
        }

        const donations = await crowdfunding.methods.getDonations(projectId).call();

        // Sort donations by amount (descending order)
        donations.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

        // Add projectId to each donor for identification
        const topThree = donations.slice(0, 3).map(d => ({ ...d, projectId }));

        // Set top donors first
        setTopDonors((prevState) => ({
          ...prevState,
          [projectId]: topThree,
        }));

        // After donations are fetched, get donor names
        await getDonorsNames(topThree);
      } catch (error) {
        console.error("Error loading top donors:", error);
      }
    };

    if (projects.length > 0 && crowdfunding && nameRegistry) {
      projects.forEach((project) => {
        loadTopDonors(project.id);
      });
    }
  }, [projects, crowdfunding, nameRegistry]);

  // Fetch and update donor names
  const getDonorsNames = async (topDonorsForProject) => {
    if (!nameRegistry) {
      console.error('Name registry contract not ready');
      return;
    }

    try {
      const donorsWithNames = await Promise.all(
        topDonorsForProject.map(async (donor) => {
          // Changed donor.address to donor.contributor
          const donorName = await nameRegistry.methods.getName(donor.contributor).call();
          return {
            ...donor,
            name: donorName || donor.contributor, // Fallback to contributor address if no name is found
          };
        })
      );

      // After fetching names, update the state with donor names
      setTopDonors((prevState) => {
        const updatedState = { ...prevState };
        donorsWithNames.forEach((donor) => {
          const projectId = donor.projectId;
          if (updatedState[projectId]) {
            updatedState[projectId] = updatedState[projectId].map((d) =>
              d.contributor === donor.contributor ? donor : d
            );
          }
        });
        return updatedState;
      });
    } catch (error) {
      console.error("Error fetching donor names:", error);
    }
  };


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

  // Added: Function to check if the chosen username is unique
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
          setUserName(name);  // Set the name on frontend as well
        } catch (error) {
          console.error('Error registering name:', error);
          alert('Failed to register name on the blockchain.');
        }
      }
    }
  };


  const createProject = async (e) => {
    e.preventDefault();
    if (!crowdfunding || !web3 || !account) {
      console.error('crowdfunding, web3 or account is not ready');
      return;
    }

    // Added: Force user to set name first
    if (userName === 'No name registered') {
      alert('Please set your name first before creating a project.');
      return;
    }

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
      if (crowdfunding) {
        loadProjects(crowdfunding);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      const revertReason = error?.data?.message || error.message || 'Transaction reverted';
      alert(`Error creating project: ${revertReason}`);
    }
  };

  const withdrawFunds = async (projectId) => {
    if (!crowdfunding || !account) {
      console.error('crowdfunding or account is not ready');
      return;
    }
    try {
      await crowdfunding.methods.withdrawFunds(projectId).send({ from: account });
      if (crowdfunding) {
        loadProjects(crowdfunding);
      }
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
      {/* show userName or account */}
      <Typography variant="subtitle1" align="center" gutterBottom>
        <h3>Your Account: {userName || account}</h3>
      </Typography>

      {/* Show the "Set My Name" button only if userName is 'No name registered' */}
      {userName === 'No name registered' && (
        <Button variant="outlined" onClick={handleSetName} style={{ marginBottom: '1rem' }}>
          Set My Name
        </Button>
      )}

      {/* <Typography variant="h6">Hello, {userName}</Typography>
      <div>
        <h2>Welcome, {userName || account}</h2>
      </div> */}
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
                    <strong>Creator:</strong> {project.creatorName} {/* Show the creator's name */}
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
                          {/* Show donor.name and amount instead of contributor address */}
                          {donor.name || donor.contributor}: {web3.utils.fromWei(donor.amount, 'ether')} ETH
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
