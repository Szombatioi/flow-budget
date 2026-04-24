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
    -o /app/publish

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

COPY --from=build /app/publish .

# Directory for the SQLite database and changelog — mounted as a volume.
# Copy the default changelog.json so the RSS feed works on first run
# even before the volume is populated.
RUN mkdir -p Data
COPY FlowBudget/FlowBudget/Data/changelog.json Data/changelog.json

# Generate a self-signed TLS certificate so the container can serve HTTPS.
# The certificate lives inside the image (fine for a local/university deployment).
# Replace with a real cert (mounted volume + env-var override) for production.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/certs \
    && openssl req -x509 -newkey rsa:2048 -days 3650 -nodes \
        -keyout /app/certs/key.pem \
        -out  /app/certs/cert.pem \
        -subj "/CN=localhost" \
    && openssl pkcs12 -export \
        -inkey /app/certs/key.pem \
        -in    /app/certs/cert.pem \
        -out   /app/certs/aspnetapp.pfx \
        -passout pass:FlowBudget_Cert! \
    && rm /app/certs/key.pem /app/certs/cert.pem

EXPOSE 5288

ENTRYPOINT ["dotnet", "FlowBudget.dll"]
