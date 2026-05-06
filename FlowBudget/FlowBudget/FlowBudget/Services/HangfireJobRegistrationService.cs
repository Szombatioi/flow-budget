using Hangfire;

namespace FlowBudget.Services;

/// <summary>
/// Registers all Hangfire recurring jobs once at application startup.
/// Using the generic AddOrUpdate&lt;TService&gt; overload so Hangfire resolves
/// the service from the DI container at execution time — not at registration time —
/// avoiding the disposed-scope problem of capturing a scoped instance here.
/// </summary>
public class HangfireJobRegistrationService(ILogger<HangfireJobRegistrationService> logger) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Registering Email job for Hangfire");
        RecurringJob.AddOrUpdate<EmailService>(
            "email-notification-job",
            service => service.NotifyUsers(),
            Cron.Daily(22, 0),
            new RecurringJobOptions
            {
                //Remember: hangfire uses UTC time zone :D
                //22:00 here -> 20:00 there
                TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time")
            }
        );

        // RecurringJob.AddOrUpdate<WishlistService>(
        //     "wishlist-transfer-job",
        //     service => service.TransferWishlistItems(),
        //     Cron.Daily(23, 59)
        // );

        return Task.CompletedTask;
    }
}
