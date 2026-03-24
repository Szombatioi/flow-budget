using FlowBudget.Data.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }
    public DbSet<Account> Accounts { get; set; }
    public DbSet<Currency> Currencies { get; set; }
    public DbSet<CostBudget> CostBudgets { get; set; }
    public DbSet<DivisionPlan> DivisionPlans { get; set; }
    public DbSet<Pocket> Pockets { get; set; }
    public DbSet<DailyExpense> DailyExpenses { get; set; }
    public DbSet<Expenditure> Expenditures { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // --- Account Configuration ---
        modelBuilder.Entity<Account>()
            .HasOne(a => a.Currency)
            .WithMany()
            .HasForeignKey(a => a.CurrencyId)
            .OnDelete(DeleteBehavior.Restrict); // Don't delete Currency if an Account uses it

        // --- Pocket Configuration ---
        modelBuilder.Entity<Pocket>()
            .HasOne(p => p.Account)
            .WithMany(a => a.Pockets)
            .HasForeignKey(p => p.AccountId)
            .OnDelete(DeleteBehavior.Cascade); // Delete Account -> Delete Pockets

        modelBuilder.Entity<Pocket>()
            .HasOne(p => p.DivisionPlan)
            .WithMany(dp => dp.Pockets)
            .HasForeignKey(p => p.DivisionPlanId)
            .OnDelete(DeleteBehavior.SetNull); // Plan deleted? Keep the pocket, just remove the link

        // --- DailyExpense Configuration ---
        modelBuilder.Entity<DailyExpense>()
            .HasOne(de => de.Pocket)
            .WithMany(p => p.DailyExpenses)
            .HasForeignKey(de => de.PocketId)
            .OnDelete(DeleteBehavior.Cascade);

        // --- Expenditure Configuration ---
        modelBuilder.Entity<Expenditure>()
            .HasOne(e => e.DailyExpense)
            .WithMany(de => de.Expenditures)
            .HasForeignKey(e => e.DailyExpenseId)
            .OnDelete(DeleteBehavior.Cascade);

        // --- CostBudget Configuration ---
        modelBuilder.Entity<CostBudget>()
            .HasOne(cb => cb.Account)
            .WithMany(a => a.CostBudgets)
            .HasForeignKey(cb => cb.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // --- DivisionPlan Configuration ---
        modelBuilder.Entity<DivisionPlan>()
            .HasOne(dp => dp.Account)
            .WithMany(a => a.DivisionPlans)
            .HasForeignKey(dp => dp.AccountId)
            .OnDelete(DeleteBehavior.Cascade);
        
    }
}