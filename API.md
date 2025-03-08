# Relationship Coach API Documentation

This API provides intelligent, compassionate communication support through real-time conversation analysis and emotional intelligence tracking.

## Base URL
```
https://[your-domain]/api
```

## Authentication
Currently, the API is open and does not require authentication.

## Endpoints

### Create Conversation
```http
POST /conversations
```

**Request Body:**
```json
{
  "name": "string",
  "isAiCompanion": boolean
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": number,
    "name": "string",
    "isAiCompanion": boolean,
    "threadId": "string" | null
  }
}
```

### Get Conversation Messages
```http
GET /conversations/:id/messages
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": number,
      "content": "string",
      "role": "user" | "companion" | "assistant",
      "conversationId": number,
      "timestamp": "string"
    }
  ]
}
```

### Analyze Message
```http
POST /analyze
```

**Request Body:**
```json
{
  "message": "string",
  "conversationId": number // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": number,
    "feedback": "string"
  }
}
```

### Create Message
```http
POST /messages
```

**Request Body:**
```json
{
  "content": "string",
  "conversationId": number
}
```

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": number,
    "content": "string",
    "role": "user",
    "conversationId": number,
    "timestamp": "string"
  }]
}
```

## WebSocket Connection
For real-time updates, connect to the WebSocket endpoint:
```
ws://[your-domain]/
```

Send messages in the format:
```json
{
  "type": "message",
  "conversationId": number,
  "content": "string"
}
```

## Error Responses
All endpoints return errors in the following format:
```json
{
  "success": false,
  "error": "Error message"
}
```
