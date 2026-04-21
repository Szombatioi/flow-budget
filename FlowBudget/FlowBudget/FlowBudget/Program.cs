using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using FlowBudget.Client.Pages;
using FlowBudget.Components;
using FlowBudget.Components.Account;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Profiles;
using FlowBudget.Services;
using MudBlazor.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveWebAssemblyComponents()
    .AddAuthenticationStateSerialization();

builder.Services.AddCascadingAuthenticationState();
builder.Services.AddScoped<IdentityRedirectManager>();

var baseUrl = builder.Configuration["ApiSettings:BaseUrl"];
builder.Services.AddHttpClient("APIClient", client =>
{
    client.BaseAddress = new Uri(baseUrl);
});

//List of injectable services
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

// builder.Services.AddAutoMapper(AppDomain.CurrentDomain.GetAssemblies()); //Note: with this parameter it scans all profiles
builder.Services.AddAutoMapper(cfg => cfg.AddProfile<MappingProfile>());

builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = IdentityConstants.ApplicationScheme;
        options.DefaultSignInScheme = IdentityConstants.ExternalScheme;
    })
    .AddIdentityCookies(o =>
    {
        o.ApplicationCookie?.Configure(c => c.LoginPath = "/auth/login");
    });
builder.Services.AddAuthorization();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ??
                       throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(connectionString));
builder.Services.AddDatabaseDeveloperPageExceptionFilter();

builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = false;
        options.Stores.SchemaVersion = IdentitySchemaVersions.Version3;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services.AddSingleton<IEmailSender<ApplicationUser>, IdentityNoOpEmailSender>();

builder.Services.AddMudServices();
builder.Services.AddControllers(); 

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.Configuration["ApiSettings:BaseUrl"]!) });

builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");
var supportedCultures = new[] { "en-US" }; //Add others here
var localizationOptions = new RequestLocalizationOptions()
    .SetDefaultCulture(supportedCultures[0])
    .AddSupportedCultures(supportedCultures)
    .AddSupportedUICultures(supportedCultures);

//Choose language based on browser language
builder.Services.Configure<RequestLocalizationOptions>(options => {
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

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
    app.UseMigrationsEndPoint();
}
else
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
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

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(FlowBudget.Client._Imports).Assembly);
app.MapAdditionalIdentityEndpoints();
app.MapControllers();

// Create database schema from the current model.
// EnsureCreated is used instead of MigrateAsync because EF Core 10 does not
// reliably discover migration types in Release-published assemblies.
// On an existing database EnsureCreated is a no-op, so restarts are safe.
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    Console.WriteLine("Ensuring database schema...");
    try
    {
        await dbContext.Database.EnsureCreatedAsync();
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("Database schema ready");
        Console.ResetColor();
    }
    catch (Exception ex)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"Error creating database schema: {ex.Message}");
        Console.ResetColor();
        throw;
    }
}

using (var scope = app.Services.CreateScope())
{
    var seederService = scope.ServiceProvider.GetRequiredService<SeederService>();
    
    Console.WriteLine("Seeding currencies...");
    await seederService.SeedCurrencies();
    Console.ForegroundColor = ConsoleColor.Green;
    Console.WriteLine("Currencies seeded successfully");
    Console.ResetColor();
    
    Console.WriteLine("Seeding categories...");
    await seederService.SeedCategories();
    Console.ForegroundColor = ConsoleColor.Green;
    Console.WriteLine("Categories seeded successfully");
    Console.ResetColor();
}

// Add additional endpoints required by the Identity /Account Razor components.

app.Run();
