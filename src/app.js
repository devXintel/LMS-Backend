const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
const subscriptionRoutes = require('./routes/subscription.routes');
const academicProfileRoutes = require('./routes/academicProfile.routes');
const courseRoutes = require('./routes/course.routes');

app.use('/subscriptions', subscriptionRoutes);
app.use('/academic-profile', academicProfileRoutes);
app.use('/courses', courseRoutes);

const categoryRoutes = require('./routes/category.routes');
app.use('/categories', categoryRoutes);

const boardRoutes = require('./routes/board.routes');
app.use('/boards', boardRoutes);

const stateRoutes = require('./routes/state.routes');
app.use('/states', stateRoutes);

const examRoutes = require('./routes/exam.routes');

app.use('/exams', examRoutes);

const streamRoutes = require('./routes/stream.routes');
app.use('/streams', streamRoutes);

const mediumRoutes = require('./routes/medium.routes');
app.use('/mediums', mediumRoutes);

const examSyllabusRoutes = require('./routes/examSyllabus.routes');
app.use('/exam-syllabus', examSyllabusRoutes);

const subjectSyllabusRoutes = require('./routes/subjectSyllabus.routes');
app.use('/subject-syllabus', subjectSyllabusRoutes);



const paymentRoutes = require('./routes/payment.routes');
app.use('/payments', paymentRoutes);

const uploadRoutes = require('./routes/upload.routes');
app.use('/upload', uploadRoutes);

const testRoutes = require('./routes/test.routes');
app.use('/tests', testRoutes);

const locationRoutes = require('./routes/location.routes');
app.use('/api/location', locationRoutes);

const embeddingRoutes = require('./routes/embedding.routes');
app.use('/embeddings', embeddingRoutes);

const teachRoutes = require('./routes/teach.routes');
app.use('/teach', teachRoutes);

const { getKeypointsOnly } = require('./controllers/teach.controller');
app.post('/api/teach/keypoints', getKeypointsOnly);

const voiceRoutes = require('./routes/voice.routes');
app.use('/api/voice', voiceRoutes);

const indicTtsRoutes = require('./routes/indicTts.routes');
app.use('/api/tts', indicTtsRoutes);

const contentNodeRoutes = require('./routes/contentNode.routes');
app.use('/api/content-nodes', contentNodeRoutes);


// Serve static files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/audio',   express.static(path.join(__dirname, '../public/audio')));
// /audio/indic/* is served automatically by the above (recursive static)

app.get('/', (req, res) => {
    res.send('LMS Backend is running');
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route Not Found',
        message: `The requested path ${req.path} does not exist on this server.`
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred.',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

module.exports = app;
// Trigger restart for Token refactor update
