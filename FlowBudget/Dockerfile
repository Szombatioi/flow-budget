# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files first so NuGet restore is a separate cached layer
COPY FlowBudget.sln .
COPY DTO/DTO.csproj DTO/
COPY FlowBudget/FlowBudget/FlowBudget.csproj FlowBudget/FlowBudget/
COPY FlowBudget/FlowBudget.Client/FlowBudget.Client.csproj FlowBudget/FlowBudget.Client/

RUN dotnet restore "FlowBudget/FlowBudget/FlowBudget.csproj"

# Copy the rest of the source and publish
COPY . .
RUN dotnet publish "FlowBudget/FlowBudget/FlowBudget.csproj" \
    -c Release \
    -o /app/publish \
    --no-restore

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

COPY --from=build /app/publish .

# Directory for the SQLite database file (mounted as a volume)
RUN mkdir -p Data

EXPOSE 5288

ENTRYPOINT ["dotnet", "FlowBudget.dll"]
