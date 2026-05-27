using System.Runtime.CompilerServices;
using DTO;
using FlowBudget.Data.Models;
using AutoMapper;
using FlowBudget.Client.Components.DTO;

namespace FlowBudget.Profiles;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Account, AccountDTO>().ReverseMap();
        CreateMap<Pocket, PocketDTO>().ReverseMap();
        CreateMap<DivisionPlan, DivisionPlanDTO>().ReverseMap();
        CreateMap<DailyExpense, DailyExpenseDTO>().ReverseMap();
        CreateMap<Category, CategoryDTO>()
            .ForMember(dest => dest.IsSystem, opt => opt.MapFrom(src => src.UserId == null));
        CreateMap<Expenditure, ExpenditureDTO>()
            .ForMember(dest => dest.Currency, opt => opt.MapFrom(src =>
                src.DailyExpense.Pocket.DivisionPlan.Account.CurrencyCode))
            .ForMember(dest => dest.PocketName, opt => opt.MapFrom(src =>
                src.DailyExpense.Pocket.Name))
            .ForMember(dest => dest.AccountId, opt => opt.MapFrom(src =>
                src.DailyExpense.Pocket.DivisionPlan.AccountId))
            .ForMember(dest => dest.WishlistName, opt => opt.MapFrom(src =>
                src.Wishlist != null ? src.Wishlist.Name : null))
            .ReverseMap();

        CreateMap<DailyExpense, WishlistAffectedExpenseDTO>()
            .ForMember(d => d.PocketName, opt => opt.MapFrom(s => s.Pocket.Name));

        CreateMap<Wishlist, WishlistDTO>()
            .ForMember(d => d.TargetAmount, opt => opt.MapFrom(s => s.Goal))
            .ForMember(d => d.ApproachType, opt => opt.MapFrom(s => s.Mode))
            .ForMember(d => d.CurrencyCode, opt => opt.MapFrom(s => s.Account.CurrencyCode))
            .ForMember(d => d.CurrentAmount, opt => opt.MapFrom(s => s.Progress.Sum(p => p.Price)))
            .ForMember(d => d.IsActive, opt => opt.MapFrom(s => s.Status == WishlistStatus.Active));
    }
}