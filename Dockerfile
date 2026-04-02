# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY FlowBudget/ .
RUN dotnet restore FlowBudget.sln
RUN dotnet publish FlowBudget.sln -c Release -o /app/publish   # <-- publish here, no --no-restore after fresh restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .          # <-- copy from build, not a phantom publish stage
RUN mkdir -p /app/Data && chmod 777 /app/Data
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "FlowBudget.dll"]
