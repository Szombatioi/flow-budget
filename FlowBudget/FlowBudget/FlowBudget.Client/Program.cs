using FlowBudget.Client.Services;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using MudBlazor;
using MudBlazor.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

builder.Services.AddAuthorizationCore(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireClaim("admin", "true"));
});
builder.Services.AddCascadingAuthenticationState();
builder.Services.AddAuthenticationStateDeserialization();


builder.Services.AddMudServices(config => { 
    config.SnackbarConfiguration.PositionClass = Defaults.Classes.Position.BottomLeft;
    config.SnackbarConfiguration.PreventDuplicates = false;
    config.SnackbarConfiguration.NewestOnTop = false;
});

builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");
builder.Services.AddSingleton<ThemeService>();

builder.Services.AddScoped(sp =>
{
    var navManager = sp.GetRequiredService<Microsoft.AspNetCore.Components.NavigationManager>();
    return new HttpClient { BaseAddress = new Uri(navManager.BaseUri) };
});
await builder.Build().RunAsync();