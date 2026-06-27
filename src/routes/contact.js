const express = require('express');
const router = express.Router();
const { createContactRequest } = require('../controllers/contactController');

router.post('/', createContactRequest);

module.exports = router;
