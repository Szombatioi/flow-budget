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
            .ReverseMap();
    }
}