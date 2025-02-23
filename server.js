import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();
const getAgentId = (language) => {
  switch (language.toLowerCase()) {
    case 'english':
    case 'en':
      return process.env.AGENT_ID1;
    case 'chinese':
    case 'zh':
      return process.env.AGENT_ID2;
    default:
      throw new Error('Unsupported language. Please specify "english" or "chinese"');
  }
};
const app = express();
app.use(cors({
  origin: '*', // Replace '*' with a specific origin if needed
  methods: 'GET,POST,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization',
}));
app.use(express.json());

const RETELL_API_URL = 'https://api.retellai.com/v2';

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
};

// Create web call endpoint
app.post('/api/create-call', async (req, res, next) => {
  try {
    const { userName, language = 'english' } = req.body;

    if (!process.env.RETELL_API_KEY) {
      throw new Error('Missing required environment variables');
    }
    const agentId = getAgentId(language);
    const response = await axios.post(
      `${RETELL_API_URL}/create-web-call`,
      {
        agent_id: agentId,
        metadata: {
          user_name: userName
        },
        retell_llm_dynamic_variables: {
          customer_name: userName
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(response);

    res.json({
      access_token: response.data.access_token,
      call_id: response.data.call_id
    });
  } catch (error) {
    if (error.response) {
      // API error response
      next({
        status: error.response.status,
        message: error.response.data.message || 'API request failed'
      });
    } else if (error.request) {
      // Network error
      next({
        status: 503,
        message: 'Unable to reach Retell API'
      });
    } else {
      next(error);
    }
  }
});

// Get call status endpoint
app.get('/api/call/:callId', async (req, res, next) => {
  try {
    const { callId } = req.params;
    
    const response = await axios.get(
      `${RETELL_API_URL}/calls/${callId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.RETELL_API_KEY}`
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    if (error.response) {
      next({
        status: error.response.status,
        message: error.response.data.message || 'Failed to retrieve call'
      });
    } else if (error.request) {
      next({
        status: 503,
        message: 'Unable to reach Retell API'
      });
    } else {
      next(error);
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
