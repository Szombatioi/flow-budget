using System.Runtime.CompilerServices;
using DTO;
using FlowBudget.Data.Models;
using AutoMapper;

namespace FlowBudget.Profiles;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Account, AccountDTO>().ReverseMap();
        CreateMap<Pocket, PocketDTO>().ReverseMap();
        CreateMap<DivisionPlan, DivisionPlanDTO>().ReverseMap();
        
    }
}