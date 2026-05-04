using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using FlowBudget.Client.Pages;
using FlowBudget.Components;
using FlowBudget.Components.Account;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Middleware;
using FlowBudget.Profiles;
using FlowBudget.Services;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using MudBlazor.Services;
using Serilog;
using Serilog.Sinks.SystemConsole.Themes;
using System.Text.Json;

// ── Serilog: bootstrap logger for startup errors, replaced by full logger after Build() ──
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("System", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}",
        theme: AnsiConsoleTheme.Code)
    .WriteTo.File(
        path: "logs/flowbudget-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Replace the default Microsoft logging with Serilog
    builder.Host.UseSerilog((ctx, services, cfg) => cfg
        .MinimumLevel.Information()
        .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.Hosting.Lifetime", Serilog.Events.LogEventLevel.Information)
        .MinimumLevel.Override("System", Serilog.Events.LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "FlowBudget")
        .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}",
        theme: AnsiConsoleTheme.Code)
        .WriteTo.File(
            path: "logs/flowbudget-.log",
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 30,
            outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss} {Level:u3}] {SourceContext} {Message:lj}{NewLine}{Exception}")
        .ReadFrom.Configuration(ctx.Configuration));

    // ── Services ──────────────────────────────────────────────────────────────

    builder.Services.AddRazorComponents()
        .AddInteractiveWebAssemblyComponents()
        // SerializeAllClaims: include custom claims (e.g. "admin") in the state
        // that is passed from the server to the Blazor WASM client.
        // Without this, only standard name/role claims are forwarded.
        .AddAuthenticationStateSerialization(o => o.SerializeAllClaims = true);

    builder.Services.AddCascadingAuthenticationState();
    builder.Services.AddScoped<IdentityRedirectManager>();

    var baseUrl = builder.Configuration["ApiSettings:BaseUrl"];
    builder.Services.AddHttpClient("APIClient", client =>
    {
        client.BaseAddress = new Uri(baseUrl);
    });

    // List of injectable services
    builder.Services.AddTransient<UserService>();
    builder.Services.AddTransient<CurrencyService>();
    builder.Services.AddTransient<AccountService>();
    builder.Services.AddTransient<IncomeService>();
    builder.Services.AddTransient<PocketService>();
    builder.Services.AddTransient<DivisionPlanService>();
    builder.Services.AddTransient<FixedExpenseService>();
    builder.Services.AddTransient<DailyExpenseService>();
    builder.Services.AddTransient<ExpenditureService>();
    builder.Services.AddTransient<CategoryService>();
    builder.Services.AddTransient<SeederService>();
    builder.Services.AddTransient<LlmHandler>();

    builder.Services.AddAutoMapper(cfg => cfg.AddProfile<MappingProfile>());

    builder.Services.AddAuthentication(options =>
        {
            options.DefaultScheme = IdentityConstants.ApplicationScheme;
            options.DefaultSignInScheme = IdentityConstants.ExternalScheme;
        })
        .AddIdentityCookies(o =>
        {
            o.ApplicationCookie?.Configure(c =>
            {
                c.LoginPath = "/auth/login";
            });
        });
    builder.Services.AddAuthorization(options =>
    {
        options.AddPolicy("AdminOnly", policy => policy.RequireClaim("admin", "true"));
    });

    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ??
                           throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseSqlite(connectionString));
    builder.Services.AddDatabaseDeveloperPageExceptionFilter();

    builder.Services.AddIdentityCore<ApplicationUser>(options =>
        {
            options.SignIn.RequireConfirmedAccount = false;
            options.Stores.SchemaVersion = IdentitySchemaVersions.Version3;
            // Relaxed so the seeded admin account can use the simple "admin" password.
            options.Password.RequireDigit = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 4;
        })
        .AddEntityFrameworkStores<ApplicationDbContext>()
        .AddSignInManager()
        .AddDefaultTokenProviders();

    builder.Services.AddSingleton<IEmailSender<ApplicationUser>, IdentityNoOpEmailSender>();

    builder.Services.AddMudServices();
    builder.Services.AddControllers();

    builder.Services.AddScoped(sp =>
        new HttpClient { BaseAddress = new Uri(builder.Configuration["ApiSettings:BaseUrl"]!) });

    builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");
    var supportedCultures = new[] { "en-US" };
    var localizationOptions = new RequestLocalizationOptions()
        .SetDefaultCulture(supportedCultures[0])
        .AddSupportedCultures(supportedCultures)
        .AddSupportedUICultures(supportedCultures);

    builder.Services.Configure<RequestLocalizationOptions>(options =>
    {
        options.DefaultRequestCulture = new Microsoft.AspNetCore.Localization.RequestCulture("en-EN");
        options.SupportedCultures = localizationOptions.SupportedCultures;
        options.SupportedUICultures = localizationOptions.SupportedUICultures;
    });

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowAll", policy =>
        {
            policy.AllowAnyOrigin()
                .AllowAnyMethod()
                .AllowAnyHeader();
        });
    });

    // ── Health Checks ─────────────────────────────────────────────────────────
    builder.Services.AddHealthChecks()
        .AddDbContextCheck<ApplicationDbContext>("database",
            tags: ["ready"]);

    // ── Pipeline ──────────────────────────────────────────────────────────────

    var app = builder.Build();

    // Global exception logger — must be first so it wraps the entire pipeline
    app.UseMiddleware<ExceptionLoggingMiddleware>();

    // Serilog request logging (logs HTTP method, path, status, elapsed)
    app.UseSerilogRequestLogging(opts =>
    {
        opts.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0}ms";
    });

    if (app.Environment.IsDevelopment())
    {
        app.UseWebAssemblyDebugging();
        app.UseMigrationsEndPoint();
    }
    else
    {
        app.UseHsts();
    }

    app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
    app.UseHttpsRedirection();
    app.UseRequestLocalization();

    app.UseRouting();
    app.UseCors("AllowAll");

    app.UseAuthentication();
    app.UseAuthorization();

    app.UseAntiforgery();

    // ── Health endpoints (no auth required — for monitoring tools) ────────────
    app.MapHealthChecks("/health", new HealthCheckOptions
    {
        // Simple liveness — returns Healthy as long as the process is up
        Predicate = _ => false,
        ResponseWriter = WriteHealthJson
    }).AllowAnonymous();

    app.MapHealthChecks("/health/ready", new HealthCheckOptions
    {
        // Readiness — includes DB ping
        Predicate = check => check.Tags.Contains("ready"),
        ResponseWriter = WriteHealthJson
    }).AllowAnonymous();

    // ── Static / Blazor ───────────────────────────────────────────────────────
    app.MapStaticAssets();
    app.MapRazorComponents<App>()
        .AddInteractiveWebAssemblyRenderMode()
        .AddAdditionalAssemblies(typeof(FlowBudget.Client._Imports).Assembly);
    app.MapAdditionalIdentityEndpoints();
    // DisableAntiforgery: Blazor's antiforgery middleware applies globally and would
    // otherwise block API controller requests (including anonymous GET endpoints like /rss).
    // Controllers handle their own authorization via [Authorize]/[AllowAnonymous].
    app.MapControllers().DisableAntiforgery();

    // ── DB migrations ─────────────────────────────────────────────────────────
    // Apply EF Core migrations at startup so containers always run with the latest schema.
    //
    // Edge-case handled: if the DB was previously created with EnsureCreated() it has no
    // __EFMigrationsHistory table, which would cause MigrateAsync() to fail trying to
    // re-create tables that already exist.  In that case we delete and recreate the DB
    // from scratch using migrations (acceptable for a dev/container environment).
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Log.Information("Applying database migrations...");
        try
        {
            var conn = db.Database.GetDbConnection();
            await conn.OpenAsync();
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText =
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='__EFMigrationsHistory'";
                var hasMigrationTable = (long)(await cmd.ExecuteScalarAsync() ?? 0L) > 0;

                if (!hasMigrationTable)
                {
                    Log.Warning(
                        "No migration history found — dropping legacy EnsureCreated database and recreating with migration tracking.");
                    await conn.CloseAsync();
                    await db.Database.EnsureDeletedAsync();
                }
                else
                {
                    await conn.CloseAsync();
                }
            }

            await db.Database.MigrateAsync();
            Log.Information("Database migrations applied successfully");
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Failed to apply database migrations");
            throw;
        }
    }

    // ── Seeding ───────────────────────────────────────────────────────────────
    using (var scope = app.Services.CreateScope())
    {
        var seederService = scope.ServiceProvider.GetRequiredService<SeederService>();

        Log.Information("Seeding currencies...");
        await seederService.SeedCurrencies();
        Log.Information("Currencies seeded");

        Log.Information("Seeding categories...");
        await seederService.SeedCategories();
        Log.Information("Categories seeded");

        Log.Information("Seeding admin user...");
        await seederService.SeedAdminUser();
        Log.Information("Admin user seeded");
    }

    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    await Log.CloseAndFlushAsync();
}

// ── Health check JSON response writer ─────────────────────────────────────────
static Task WriteHealthJson(HttpContext ctx, Microsoft.Extensions.Diagnostics.HealthChecks.HealthReport report)
{
    ctx.Response.ContentType = "application/json";
    var result = JsonSerializer.Serialize(new
    {
        status = report.Status.ToString(),
        duration = report.TotalDuration.TotalMilliseconds.ToString("F1") + "ms",
        checks = report.Entries.Select(e => new
        {
            name = e.Key,
            status = e.Value.Status.ToString(),
            description = e.Value.Description,
            duration = e.Value.Duration.TotalMilliseconds.ToString("F1") + "ms",
            error = e.Value.Exception?.Message
        })
    }, new JsonSerializerOptions { WriteIndented = true });
    return ctx.Response.WriteAsync(result);
}
