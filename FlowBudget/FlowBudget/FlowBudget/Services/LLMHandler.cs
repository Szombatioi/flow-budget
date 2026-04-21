using System.Text.Json;
using DTO;

namespace FlowBudget.Services;

public class LlmHandler(HttpClient http)
{
    private string ReturnPrompt(string language, List<CategoryHeaderDTO> categories)
    {
        var categoriesString = string.Join(", ", categories.Select(c => $"{c.Name} ({c.Id})"));
        return $"""
                Examine the uploaded image that should contain a receipt from a store. If the image is not about a receipt, immediately return an empty array as result.
                Otherwise, try to extract each item listed on this image, and return an array as result.
                The array's elements should be the following: item name (try not to use long names), price (only the number, the currency is not needed, use decimal C# type), category (i will tell you at the end of the prompt what categories are available to choose from)
                Result format for each array element:
                    name: <name>,
                    price: <price>,
                    category: <category id>,
                The result should be written in the given language: {language}.
                When extracting an item from the receipt, select any of the categories (OR null, if none of them match):
                {categoriesString}
                When you set a category, set its ID, not their Name! The name is just helping you understand the categories.
                """;
    }
    
    public async Task<T> UploadReceipt<T>(string resultLanguage, List<CategoryHeaderDTO> availableCategories, string apiKey, IFormFile file)
    {
        var base64Image = await ConvertFileToBase64(file);
    
        // 1. Add 'response_mime_type' to the payload to help Gemini return pure JSON
        var payload = new 
        {
            contents = new[] {
                new {
                    parts = new object[] {
                        new { text = ReturnPrompt(resultLanguage, availableCategories) },
                        new { inline_data = new { mime_type = file.ContentType, data = base64Image } }
                    }
                }
            },
            generationConfig = new {
                response_mime_type = "application/json" // Force JSON output
            }
        };

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key={apiKey}";
    
        var response = await http.PostAsJsonAsync(url, payload);
        response.EnsureSuccessStatusCode();

        // 2. Deserialize into the Gemini Wrapper first
        var fullResponse = await response.Content.ReadFromJsonAsync<LlmResponse>();
    
        // 3. Extract the text string
        var jsonString = fullResponse?.candidates?.FirstOrDefault()?.content?.parts?.FirstOrDefault()?.text;

        if (string.IsNullOrEmpty(jsonString))
            throw new Exception("Gemini returned an empty response.");

        // 4. Clean Markdown if Gemini ignored the 'application/json' config
        if (jsonString.StartsWith("```json"))
        {
            jsonString = jsonString.Replace("```json", "").Replace("```", "").Trim();
        }

        // 5. Finally, deserialize the actual list of items
        return JsonSerializer.Deserialize<T>(jsonString, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) 
               ?? throw new Exception("Failed to parse receipt items.");
    }
    
    public async Task<string> ConvertFileToBase64(IFormFile file)
    {
        string base64Image;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            byte[] fileBytes = ms.ToArray();
            base64Image = Convert.ToBase64String(fileBytes);
        }
        return base64Image;
    }
}

//These classes match the request format that Gemini expects
public class LlmRequest
{
    public List<Content> contents { get; set; }
}

public class Content
{
    public List<Part> parts { get; set; }
}

public class Part
{
    public string text { get; set; }
    public InlineData inline_data { get; set; }
}

public class InlineData
{
    public string mime_type { get; set; }
    public string data { get; set; }
}

public class LlmResponse
{
    public List<Candidate> candidates { get; set; }
}

public class Candidate
{
    public ResponseContent content { get; set; }
}

public class ResponseContent
{
    public List<ResponsePart> parts { get; set; }
}

public class ResponsePart
{
    public string text { get; set; }
}