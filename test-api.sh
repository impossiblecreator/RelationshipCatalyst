#!/bin/bash

# Base URL - replace with your actual domain when deployed
BASE_URL="http://localhost:5000/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Testing Relationship Coach API"
echo "=============================="

# 1. Create a new conversation
echo -e "\n${GREEN}1. Creating a new conversation...${NC}"
CONV_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Chat","isAiCompanion":true}' \
  "${BASE_URL}/conversations")
echo "Response: $CONV_RESPONSE"

# Extract conversation ID from response
CONV_ID=$(echo $CONV_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo "Conversation ID: $CONV_ID"

# 2. Get messages (should be empty initially)
echo -e "\n${GREEN}2. Getting messages for conversation...${NC}"
curl -s -X GET "${BASE_URL}/conversations/${CONV_ID}/messages" | json_pp

# 3. Analyze a message
echo -e "\n${GREEN}3. Analyzing a test message...${NC}"
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "message":"Hey, I was wondering if you would like to grab coffee sometime?",
    "conversationId":'${CONV_ID}',
    "age": 25,
    "gender": "non-binary"
  }' \
  "${BASE_URL}/analyze" | json_pp

# 4. Send a message
echo -e "\n${GREEN}4. Sending a message...${NC}"
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"Hey, would you like to grab coffee sometime?","conversationId":'${CONV_ID}'}' \
  "${BASE_URL}/messages" | json_pp

# 5. Get messages again (should now contain our message)
echo -e "\n${GREEN}5. Getting updated messages...${NC}"
curl -s -X GET "${BASE_URL}/conversations/${CONV_ID}/messages" | json_pp

echo -e "\n${GREEN}API Testing Complete!${NC}"