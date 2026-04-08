using FlowBudget.Data.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole<string>, string>{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }
    public DbSet<Account> Accounts { get; set; }
    public DbSet<Currency> Currencies { get; set; }
    public DbSet<Income> Incomes { get; set; }
    public DbSet<DivisionPlan> DivisionPlans { get; set; }
    public DbSet<Pocket> Pockets { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<DailyExpense> DailyExpenses { get; set; }
    public DbSet<Expenditure> Expenditures { get; set; }
    public DbSet<FixedExpense> FixedExpenses { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // --- Account Configuration ---
        modelBuilder.Entity<Account>()
            .HasOne(a => a.Currency)
            .WithMany()
            .HasForeignKey(a => a.CurrencyCode)
            .OnDelete(DeleteBehavior.Restrict); // Don't delete Currency if an Account uses it
        
        modelBuilder.Entity<Category>()
            .HasOne(c => c.User)
            .WithMany(u => u.Categories)
            .HasForeignKey(c => c.UserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        // --- Pocket Configuration ---
        // modelBuilder.Entity<Pocket>()
        //     .HasOne(p => p.Account)
        //     .WithMany(a => a.Pockets)
        //     .HasForeignKey(p => p.AccountId)
        //     .OnDelete(DeleteBehavior.Cascade); // Delete Account -> Delete Pockets

        modelBuilder.Entity<Pocket>()
            .HasOne(p => p.DivisionPlan)
            .WithMany(dp => dp.Pockets)
            .HasForeignKey(p => p.DivisionPlanId)
            .OnDelete(DeleteBehavior.Cascade);

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

        modelBuilder.Entity<Expenditure>()
            .HasOne(e => e.Category)
            .WithMany()
            .HasForeignKey(e => e.CategoryId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // --- CostBudget Configuration ---
        modelBuilder.Entity<Income>()
            .HasOne(cb => cb.Account)
            .WithMany(a => a.Incomes)
            .HasForeignKey(cb => cb.AccountId)
            .OnDelete(DeleteBehavior.Cascade);
        
        modelBuilder.Entity<FixedExpense>()
            .HasOne(fe => fe.Account)
            .WithMany(a => a.FixedExpenses)
            .HasForeignKey(fe => fe.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // --- DivisionPlan Configuration ---
        modelBuilder.Entity<DivisionPlan>()
            .HasOne(dp => dp.Account)
            .WithMany(a => a.DivisionPlans)
            .HasForeignKey(dp => dp.AccountId)
            .OnDelete(DeleteBehavior.Cascade);
        
    }
}