using FlowBudget.Services.Exceptions;
using System.Net;
using System.Text.Json;

namespace FlowBudget.Middleware;

/// <summary>
/// Catches unhandled exceptions, logs them via Serilog, and returns a structured JSON error response.
/// Place this as the first middleware so it wraps the entire pipeline.
/// </summary>
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
            await WriteErrorResponse(context, HttpStatusCode.NotFound, "Resource not found.");
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
            await WriteErrorResponse(context, HttpStatusCode.Conflict, "Data inconsistency detected.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception. Path: {Path} Method: {Method}",
                context.Request.Path, context.Request.Method);
            await WriteErrorResponse(context, HttpStatusCode.InternalServerError, "An unexpected error occurred.");
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
