# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY FlowBudget/ .
RUN dotnet restore FlowBudget.sln
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
COPY init-db.sh .

# Create data directory for SQLite database
RUN mkdir -p /app/data && chmod +x /app/init-db.sh

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["/app/init-db.sh"]
