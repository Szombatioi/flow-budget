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
        CreateMap<Expenditure, ExpenditureDTO>()
            .ForMember(dest => dest.Currency, opt => opt.MapFrom(src =>
                src.DailyExpense.Pocket.DivisionPlan.Account.CurrencyCode))
            .ReverseMap();
    }
}