# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files
COPY FlowBudget/FlowBudget/FlowBudget/FlowBudget.csproj FlowBudget/
COPY FlowBudget/FlowBudget/FlowBudget.Client/FlowBudget.Client.csproj FlowBudget.Client/
COPY FlowBudget/DTO/DTO.csproj DTO/

# Copy all source files
COPY . .

# Restore dependencies
RUN dotnet restore FlowBudget/FlowBudget/FlowBudget/FlowBudget.csproj

# Build the application
RUN dotnet build FlowBudget/FlowBudget/FlowBudget/FlowBudget.csproj -c Release -o /app/build

# Publish stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS publish
WORKDIR /src

# Copy everything from build context
COPY . .

# Restore and publish
RUN dotnet restore FlowBudget/FlowBudget/FlowBudget/FlowBudget.csproj
RUN dotnet publish FlowBudget/FlowBudget/FlowBudget/FlowBudget.csproj -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=publish /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "FlowBudget.dll"]
