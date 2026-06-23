# PRD 1.0 - Interactive AI Teacher MVP

## Project Name

Working Name: Infinite Teacher

Version: Phase 1 MVP

Status: Planning

---

# Vision

Create an AI teacher that can teach any topic through real-time voice conversation and visual explanations.

Unlike videos, courses, or chatbots, the user should feel like they are learning from a live teacher who can:

* Explain concepts
* Draw diagrams
* Answer questions
* Pause and resume lessons
* Adapt explanations during the session

The primary goal is to make learning feel like a one-on-one tutoring session rather than consuming content.

---

# Problem Statement

Current learning methods have significant limitations.

### Search Engines

Users can find information but cannot interact with the content.

### YouTube Videos

Users can watch explanations but cannot interrupt naturally and ask questions.

### Courses

Users follow fixed content regardless of their understanding.

### AI Chatbots

Users can ask questions but are not actively taught through structured lessons.

There is currently no simple system that combines:

* Real-time teaching
* Voice conversation
* Visual explanations
* Continuous interaction

into a single experience.

---

# Product Goal

Build the simplest possible AI teacher that can:

1. Teach a topic through voice.
2. Draw visual explanations on a canvas.
3. Allow interruption at any time.
4. Answer questions.
5. Resume the lesson from where it stopped.

Success is not measured by perfect teaching.

Success is measured by whether the experience feels like interacting with a teacher instead of a chatbot.

---

# Core User Flow

## Create Session

User enters:

"Teach me Binary Search."

or

"Explain Recursion from scratch."

A new learning session begins.

---

## Lesson Initialization

The AI creates:

* Topic
* Lesson Structure
* Initial Teaching State

Example:

Topic:
Binary Search

Lesson Graph:

* Sorted Arrays
* Middle Element
* Search Space Reduction
* Complexity
* Example Problem

---

## Teaching Begins

The AI starts explaining.

The AI speaks naturally.

The AI draws on the canvas while explaining.

Example:

Voice:

"Let's start with a sorted array."

Canvas:

Draws:

1 3 5 7 9 11 13

---

## User Interrupts

User says:

"Why does the array need to be sorted?"

The lesson immediately pauses.

The AI answers the question.

The AI updates the canvas if necessary.

---

## Lesson Resumes

After answering:

"Now let's continue from where we stopped."

The AI resumes from the exact lesson step.

---

## Session End

The session ends when:

* The lesson completes.
* The user exits.
* The user starts another topic.

No long-term user memory is stored in Phase 1.

Only session memory exists.

---

# MVP Features

## Feature 1: Voice Conversation

### User Input

User speaks naturally.

Speech is converted to text.

### AI Response

AI generates response.

Response is converted to speech.

### Requirements

* Low latency
* Natural interruption handling
* Streaming responses

---

## Feature 2: Visual Teaching Canvas

Canvas should function as a live teaching board.

The AI can:

* Draw shapes
* Draw arrows
* Draw boxes
* Add text
* Create diagrams
* Create flowcharts
* Create simple graphs

The canvas updates in real time.

The canvas is synchronized with explanations.

---

## Feature 3: Session Memory

Memory exists only inside the current session.

Example:

{
"topic": "Binary Search",
"current_step": "Middle Element",
"completed": [
"Sorted Arrays"
]
}

Memory is deleted when the session ends.

---

## Feature 4: Lesson State Tracking

The system must know:

* Current topic
* Current lesson step
* Completed lesson steps
* Pending lesson steps

Example:

Binary Search

Completed:

* Sorted Arrays

Current:

* Middle Element

Pending:

* Complexity
* Practice

This allows interruption and resumption.

---

## Feature 5: Interruption Handling

Users can interrupt at any moment.

Example:

Teacher:
"Now let's discuss recursion..."

User:
"Wait, what is a function?"

System behavior:

1. Pause lesson.
2. Save lesson state.
3. Answer question.
4. Resume lesson.

This feature is critical.

---

# Non-Goals

The following are NOT part of Phase 1.

## No Avatar

No animated teacher.

No video generation.

No facial expressions.

---

## No Long-Term User Memory

The system will not remember users across sessions.

---

## No Adaptive Learning Profiles

No personalized curriculum.

No learner profiling.

No learning history.

---

## No Multi-Agent Architecture

Only one teaching agent.

No planner agents.

No memory agents.

No specialized agents.

---

## No Assessments

No quizzes.

No exams.

No scoring.

---

## No Course Generation

The AI only teaches in real time.

---

# Architecture

## Frontend

React

Components:

* Session Screen
* Voice Controls
* Canvas
* Lesson Status
* Audio Player

---

## Backend

Node.js

Responsibilities:

* Session Management
* Lesson State Management
* AI Orchestration
* Voice Pipeline
* Visual Pipeline

---

# Core System Architecture

User Voice

↓

Speech To Text

↓

Teacher Agent

↓

Structured Output

{
speech,
visuals,
state_updates
}

↓

Frontend

1. Render Visuals
2. Confirm Rendered
3. Play Audio

---

# Structured AI Response Format

Example:

{
"speech":
"Let's start with a sorted array.",

"visuals": [
{
"action": "draw_array",
"values": [1,3,5,7,9]
}
],

"state_update": {
"current_step": "Sorted Arrays"
}
}

The AI never directly controls the canvas.

The AI generates commands.

The frontend executes commands.

---

# Synchronization Requirements

A major objective of the MVP.

Problem:

Voice can become ahead of visuals.

This creates a poor learning experience.

Required flow:

1. AI generates response.
2. Visual commands execute.
3. Frontend confirms completion.
4. Audio begins.

Visual and voice must remain synchronized.

---

# Teaching State Object

Example:

{
"topic": "Binary Search",

"current_step":
"Middle Element",

"completed_steps": [
"Sorted Arrays"
],

"pending_steps": [
"Search Space Reduction",
"Complexity"
],

"paused": false
}

This object represents the current teaching state.

It is updated continuously.

---

# Success Criteria

The MVP is successful if users can:

1. Start a lesson.
2. Listen to explanations.
3. Watch visual demonstrations.
4. Interrupt naturally.
5. Receive answers.
6. Resume lessons smoothly.

without feeling like they are interacting with a chatbot.

The experience should feel closer to a live tutor than a traditional AI assistant.

---

# Future Versions (Not MVP)

Phase 2

* User profiles
* Persistent memory
* Progress tracking
* Quizzes
* Adaptive teaching

Phase 3

* Multiple teaching agents
* Curriculum generation
* Learning analytics
* Personalized pathways

Phase 4

* AI avatars
* Virtual classrooms
* Real-time demonstrations
* Human-like tutoring experience

---

# Final Product Definition

An AI-powered interactive teaching system that combines voice conversation, real-time visual explanations, and lesson-state awareness to create a learning experience that feels like a live one-on-one tutoring session.
