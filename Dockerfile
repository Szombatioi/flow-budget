# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution file and project files
COPY FlowBudget/FlowBudget.sln .
COPY FlowBudget/FlowBudget/FlowBudget/FlowBudget.csproj ./FlowBudget/FlowBudget/
COPY FlowBudget/FlowBudget/FlowBudget.Client/FlowBudget.Client.csproj ./FlowBudget/FlowBudget.Client/
COPY FlowBudget/DTO/DTO.csproj ./DTO/

# Copy all source files
COPY FlowBudget/ .

# Restore and build
RUN dotnet restore
RUN dotnet build -c Release

# Publish stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS publish
WORKDIR /src

COPY --from=build /src .
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=publish /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "FlowBudget.dll"]
