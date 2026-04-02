# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy the entire FlowBudget directory with all projects
COPY FlowBudget/ .

# Restore dependencies
RUN dotnet restore FlowBudget.sln

# Build the solution
RUN dotnet build FlowBudget.sln -c Release --no-restore

# Publish stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS publish
WORKDIR /src

COPY FlowBudget/ .
RUN dotnet restore FlowBudget.sln
RUN dotnet publish FlowBudget.sln -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=publish /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "FlowBudget.dll"]
