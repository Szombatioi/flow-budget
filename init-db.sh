#!/bin/bash
set -e

# Run the application in the background
dotnet FlowBudget.dll &
APP_PID=$!

# Give the app time to start and create/migrate the database
sleep 10

# Bring the app to the foreground
wait $APP_PID
