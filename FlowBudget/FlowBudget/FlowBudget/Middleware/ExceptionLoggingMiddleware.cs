using FlowBudget.Services.Exceptions;
using System.Net;
using System.Text.Json;

namespace FlowBudget.Middleware;

// Catching unhandled exceptions, logs them, then returns a HTTP response
public class ExceptionLoggingMiddleware(RequestDelegate next, ILogger<ExceptionLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (NotFoundException ex)
        {
            logger.LogWarning(ex, "Resource not found. Path: {Path}", context.Request.Path);
            await WriteErrorResponse(context, HttpStatusCode.NotFound, string.IsNullOrEmpty(ex.Message) ? "Resource not found." : ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized access attempt. Path: {Path} User: {User}",
                context.Request.Path, context.User.Identity?.Name ?? "anonymous");
            await WriteErrorResponse(context, HttpStatusCode.Forbidden, ex.Message);
        }
        catch (InconsistencyException ex)
        {
            logger.LogError(ex, "Data inconsistency detected. Path: {Path}", context.Request.Path);
            await WriteErrorResponse(context, HttpStatusCode.Conflict, string.IsNullOrEmpty(ex.Message) ? "Data inconsistency detected." : ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception. Path: {Path} Method: {Method}",
                context.Request.Path, context.Request.Method);
            await WriteErrorResponse(context, HttpStatusCode.InternalServerError, string.IsNullOrEmpty(ex.Message) ? "An unexpected error occurred." : ex.Message);
        }
    }

    private static Task WriteErrorResponse(HttpContext context, HttpStatusCode status, string message)
    {
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json";
        var body = JsonSerializer.Serialize(new { error = message });
        return context.Response.WriteAsync(body);
    }
}
