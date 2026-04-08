# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY FlowBudget/ .
RUN dotnet restore FlowBudget.sln
RUN dotnet publish FlowBudget/FlowBudget.csproj -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/Data && chmod 777 /app/Data
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "FlowBudget.dll"]
