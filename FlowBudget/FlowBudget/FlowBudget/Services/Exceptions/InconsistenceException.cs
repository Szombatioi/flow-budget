namespace FlowBudget.Services.Exceptions;

//Use cases: when there are inconsistencies in the database, e.g.
//a. Ratio of pockets are > 100
//b. The nr. of generated daily expense records are not equals of how many should be in a month
//c. ...
public class InconsistencyException : Exception
{
    
}