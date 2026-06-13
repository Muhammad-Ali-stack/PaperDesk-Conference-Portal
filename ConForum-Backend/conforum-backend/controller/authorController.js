import supabase from "../config/supabase.js";
import { sendMail } from "../config/mailer.js";
import { validatePdf } from "../utils_helpers/simplePdfValidator.js";

/**
 * Helper to construct a public Supabase storage URL
 */
const getSupabasePublicUrl = (bucket, filePath) => {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
};

// ==============================
// 1. submitPaperController
// ==============================
export const submitPaperController = async (req, res) => {
  try {
    const {
      title,
      abstract,
      keywords,
      conferenceName,
      conferenceAcronym,
      userId,
      conferenceId,
    } = req.body;
    let { authors } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required." });
    }
    if (!conferenceId) {
      return res.status(400).json({ success: false, message: "Conference ID is required." });
    }
    if (!title || !abstract || !keywords || !conferenceAcronym) {
      return res.status(400).json({ success: false, message: "All paper details are required." });
    }

    if (typeof authors === "string") {
      try {
        authors = JSON.parse(authors);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid authors JSON format." });
      }
    }

    const { data: conference } = await supabase
      .from("conferences")
      .select("id, mode")
      .eq("id", conferenceId)
      .maybeSingle();

    if (!conference) {
      return res.status(404).json({ success: false, message: "Conference not found." });
    }

    const { data: existingPaper } = await supabase
      .from("research_papers")
      .select("id")
      .eq("title", title)
      .eq("conference_id", conferenceId)
      .maybeSingle();

    if (existingPaper) {
      return res.status(400).json({
        success: false,
        message: "A paper with this title already exists for this conference.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "File upload is required." });
    }
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ success: false, message: "Invalid file type. Only PDF files are allowed." });
    }

    const pdfValidation = await validatePdf(req.file.buffer, req.file.originalname);
    if (!pdfValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: pdfValidation.message,
        data: { validation: pdfValidation },
      });
    }

    const fileName = `${Date.now()}_${req.file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("paper-submissions")
      .upload(fileName, req.file.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      return res.status(500).json({ 
        success: false, 
        message: `Supabase upload error: ${uploadError.message}` 
      });
    }

    const filePath = getSupabasePublicUrl("paper-submissions", fileName);

    if (!authors || !Array.isArray(authors) || !authors.length) {
      return res.status(400).json({ success: false, message: "At least one author is required." });
    }

    const validAuthor = authors.find((author) => author.firstName && author.email);
    if (!validAuthor) {
      return res.status(400).json({
        success: false,
        message: "At least one author must have firstName and email filled.",
      });
    }

    await supabase
      .from("user_conference_roles")
      .upsert(
        { user_id: userId, conference_id: conferenceId, role: "author" },
        { onConflict: "user_id,conference_id,role" }
      );

    const keywordsArr = typeof keywords === "string"
      ? keywords.split(",").map((kw) => kw.trim())
      : keywords;

    const validationInfo = {
      validated: true,
      timestamp: new Date().toISOString(),
      message: "PDF passed basic validation checks.",
      fileInfo: pdfValidation.fileInfo,
      note: "IEEE compliance will be reviewed manually by conference organizers.",
    };

    const { data: paper, error: paperError } = await supabase
      .from("research_papers")
      .insert({
        title,
        abstract,
        keywords: keywordsArr,
        paper_file_path: filePath,
        conference_id: conferenceId,
        conference_name: conferenceName,
        conference_acronym: conferenceAcronym,
        validation_info: validationInfo,
      })
      .select()
      .single();

    if (paperError) {
      return res.status(500).json({ 
        success: false, 
        message: "Error saving paper.", 
        data: { error: paperError.message } 
      });
    }

    const authorEmails = authors.map(a => a.email).filter(Boolean);
    const { data: existingAuthors } = await supabase
      .from("authors")
      .select("id, email")
      .in("email", authorEmails);
    
    const existingAuthorMap = new Map();
    if (existingAuthors) {
      existingAuthors.forEach(author => {
        existingAuthorMap.set(author.email, author.id);
      });
    }

    const authorIds = [];
    for (const authorData of authors) {
      let authorId = existingAuthorMap.get(authorData.email);
      
      if (!authorId) {
        const { data: newAuthor, error: insertError } = await supabase
          .from("authors")
          .insert({
            first_name: authorData.firstName,
            last_name: authorData.lastName || null,
            email: authorData.email,
            country: authorData.country || null,
            affiliation: authorData.affiliation || null,
            web_page: authorData.webPage || null,
            corresponding_author: authorData.correspondingAuthor || false,
            user_id: userId,
          })
          .select("id")
          .single();
        
        if (insertError) {
          console.error("Error inserting author:", insertError);
          continue;
        }
        authorId = newAuthor.id;
      }
      if (authorId) {
        authorIds.push(authorId);
      }
    }

    const validAuthorIds = authorIds.filter(Boolean);
    if (validAuthorIds.length > 0) {
      await supabase
        .from("paper_authors")
        .insert(validAuthorIds.map((authorId) => ({ 
          paper_id: paper.id, 
          author_id: authorId 
        })));
    }

    const authorEmailsList = authors.map((a) => a.email).filter(Boolean);
    if (authorEmailsList.length > 0) {
      const submissionEmailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
        <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background-color:#4B707A;padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px;">PaperDesk</h1>
                    <p style="margin:6px 0 0;color:#d1e8eb;font-size:13px;">Conference Management System</p>
                   </td>
                 </tr>
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">Paper Submitted Successfully</h2>
                    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Your paper has been received and is under review.</p>
                    <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
                      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4B707A;text-transform:uppercase;letter-spacing:0.5px;">Submission Details</p>
                      <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Title:</strong> ${title}</p>
                      <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Conference:</strong> ${conferenceName || conferenceAcronym}</p>
                      <p style="margin:0;font-size:14px;color:#374151;"><strong>Status:</strong> Pending Review</p>
                    </div>
                    <p style="margin:0;font-size:13px;color:#9ca3af;">You will receive further updates as your paper progresses through the review process.</p>
                   </td>
                 </tr>
                <tr>
                  <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;">Copyright ${new Date().getFullYear()} PaperDesk - Conference Management System</p>
                   </td>
                 </tr>
               </table>
             </td>
           </tr>
         </table>
        </body>
        </html>
      `;
      Promise.all(
        authorEmailsList.map((email) =>
          sendMail({
            type: "paper",
            to: email,
            subject: `Paper Submitted: ${title}`,
            html: submissionEmailHtml,
          })
        )
      ).catch((err) => console.error("Error sending confirmation emails:", err));
    }

    return res.status(201).json({
      success: true,
      message: "Paper submitted successfully.",
      data: { paper, validation: validationInfo },
    });
  } catch (error) {
    console.error("submitPaperController error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error submitting paper.", 
      data: { error: error.message } 
    });
  }
};

// ==============================
// 2. updatePaperController
// ==============================
export const updatePaperController = async (req, res) => {
  try {
    const paperId = req.params.id;
    const { title, abstract, keywords, isResubmit } = req.body;
    const file = req.file;

    if (!paperId) {
      return res.status(400).json({ success: false, message: "Paper ID is required." });
    }

    const { data: existingPaper, error: fetchError } = await supabase
      .from("research_papers")
      .select("*")
      .eq("id", paperId)
      .maybeSingle();

    if (fetchError || !existingPaper) {
      return res.status(404).json({ success: false, message: "Paper not found." });
    }

    if (isResubmit === true || isResubmit === "true") {
      if (existingPaper.conference_id) {
        const { data: conference } = await supabase
          .from("conferences")
          .select("max_resubmissions")
          .eq("id", existingPaper.conference_id)
          .maybeSingle();

        const limit = conference?.max_resubmissions ?? null;
        const currentCount = existingPaper.resubmission_count ?? 0;

        if (limit !== null && currentCount >= limit) {
          return res.status(403).json({
            success: false,
            message: `Resubmission limit reached. This conference allows a maximum of ${limit} resubmission${limit === 1 ? "" : "s"} per paper.`,
          });
        }
      }
    }

    const updates = {};

    if (isResubmit === true || isResubmit === "true") {
      updates.status = "resubmitted";
      updates.final_decision = "pending";
      updates.organizer_plagiarism_score = null;
      updates.resubmission_count = (existingPaper.resubmission_count ?? 0) + 1;
      updates.validation_info = {
        validated: true,
        timestamp: new Date().toISOString(),
        message: "PDF passed basic validation checks on resubmission.",
        note: "IEEE compliance will be reviewed manually by conference organizers.",
      };
    }

    if (title) updates.title = title;
    if (abstract) updates.abstract = abstract;
    if (keywords) updates.keywords = keywords.split(",").map((kw) => kw.trim());

    if (file) {
      if (file.mimetype !== "application/pdf") {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid file type. Only PDF files are allowed." 
        });
      }

      const pdfValidation = await validatePdf(file.buffer, file.originalname);
      if (!pdfValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: pdfValidation.message,
          data: { validation: pdfValidation },
        });
      }

      if (existingPaper.paper_file_path) {
        const oldFileName = existingPaper.paper_file_path.split("/").pop();
        await supabase.storage.from("paper-submissions").remove([oldFileName]);
      }

      const fileName = `${Date.now()}_${file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("paper-submissions")
        .upload(fileName, file.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.mimetype,
        });

      if (uploadError) {
        return res.status(500).json({ 
          success: false, 
          message: `Supabase upload error: ${uploadError.message}` 
        });
      }

      updates.paper_file_path = getSupabasePublicUrl("paper-submissions", fileName);
      
      if (isResubmit === true || isResubmit === "true") {
        updates.validation_info = {
          validated: true,
          timestamp: new Date().toISOString(),
          message: "PDF passed basic validation checks on resubmission.",
          fileInfo: pdfValidation.fileInfo,
          note: "IEEE compliance will be reviewed manually by conference organizers.",
        };
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ success: true, message: "No changes detected." });
    }

    const { data: updatedPaper, error: updateError } = await supabase
      .from("research_papers")
      .update(updates)
      .eq("id", paperId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ success: false, message: "Error updating paper." });
    }

    if (isResubmit === true || isResubmit === "true") {
      await supabase.from("reviews").delete().eq("paper_id", paperId);
      await supabase.from("assignments").delete().eq("paper_id", paperId);
    }

    return res.status(200).json({
      success: true,
      message: "Paper updated successfully.",
      data: { paper: updatedPaper },
    });
  } catch (error) {
    console.error("updatePaperController error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error updating paper.", 
      data: { error: error.message } 
    });
  }
};

// ==============================
// 3. getAuthorConferencesController
// ==============================
export const getAuthorConferencesController = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required." });
    }

    const { data, error } = await supabase
      .from("user_conference_roles")
      .select("conference_id, conferences!conference_id(id, conference_name, acronym)")
      .eq("user_id", userId)
      .eq("role", "author");

    if (error) {
      return res.status(500).json({ 
        success: false, 
        message: "Error fetching conferences.", 
        data: { error: error.message } 
      });
    }

    const conferences = (data || [])
      .map((row) => row.conferences)
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      message: "Conferences fetched successfully.",
      data: { conferences },
    });
  } catch (error) {
    console.error("getAuthorConferencesController error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error fetching conferences.", 
      data: { error: error.message } 
    });
  }
};

// ==============================
// 4. getSubmissionStatusController
// ==============================
export const getSubmissionStatusController = async (req, res) => {
  try {
    const { conferenceId, paperId } = req.params;

    if (!conferenceId || !paperId) {
      return res.status(400).json({ 
        success: false, 
        message: "Conference ID and Paper ID are required." 
      });
    }

    const { data: conference, error: confError } = await supabase
      .from("conferences")
      .select("max_resubmissions")
      .eq("id", conferenceId)
      .maybeSingle();

    if (confError || !conference) {
      return res.status(404).json({ success: false, message: "Conference not found." });
    }

    const { data: paper, error: paperError } = await supabase
      .from("research_papers")
      .select("resubmission_count")
      .eq("id", paperId)
      .eq("conference_id", conferenceId)
      .maybeSingle();

    if (paperError || !paper) {
      return res.status(404).json({ success: false, message: "Paper not found." });
    }

    const maxResubmissions = conference.max_resubmissions;
    const currentCount = paper.resubmission_count ?? 0;

    if (maxResubmissions === null || maxResubmissions === undefined) {
      return res.status(200).json({
        success: true,
        message: "Submission status fetched.",
        data: {
          unlimited: true,
          canResubmit: true,
          currentCount,
          maxResubmissions: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Submission status fetched.",
      data: {
        unlimited: false,
        canResubmit: currentCount < maxResubmissions,
        currentCount,
        maxResubmissions,
      },
    });
  } catch (error) {
    console.error("getSubmissionStatusController error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching submission status.",
      data: { error: error.message },
    });
  }
};

// ==============================
// 5. deletePaperController
// ==============================
export const deletePaperController = async (req, res) => {
  try {
    const { id, conferenceId } = req.params;

    const { data: paper } = await supabase
      .from("research_papers")
      .select("*, paper_authors(author_id, authors(id, user_id))")
      .eq("id", id)
      .maybeSingle();

    if (!paper) {
      return res.status(404).json({ success: false, message: "Paper not found." });
    }

    if (paper.paper_file_path) {
      const fileName = paper.paper_file_path.split("/").pop();
      await supabase.storage.from("paper-submissions").remove([fileName]);
    }

    for (const pa of paper.paper_authors || []) {
      const authorUserId = pa.authors?.user_id;
      const authorId = pa.author_id;

      const { data: otherPapers } = await supabase
        .from("paper_authors")
        .select("paper_id")
        .eq("author_id", authorId)
        .neq("paper_id", id);

      if (!otherPapers || otherPapers.length === 0) {
        await supabase.from("authors").delete().eq("id", authorId);
        
        if (authorUserId) {
          await supabase
            .from("user_conference_roles")
            .delete()
            .eq("user_id", authorUserId)
            .eq("conference_id", conferenceId)
            .eq("role", "author");
        }
      }
    }

    await supabase.from("research_papers").delete().eq("id", id);

    return res.status(200).json({
      success: true,
      message: "Paper and associated data deleted successfully.",
    });
  } catch (error) {
    console.error("deletePaperController error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error deleting paper.", 
      data: { error: error.message } 
    });
  }
};

// ==============================
// 6. getAllResearchPapersController
// ==============================
export const getAllResearchPapersController = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { data: papers, error } = await supabase
      .from("paper_authors")
      .select(`
        paper_id,
        research_papers!inner (
          id,
          title,
          abstract,
          keywords,
          paper_file_path,
          status,
          final_decision,
          created_at,
          conference_id,
          conference_name,
          conference_acronym,
          validation_info,
          resubmission_count,
          reviews (comments_for_authors, technical_confidence),
          organizer_comments_for_authors
        )
      `)
      .eq("authors.user_id", userId);

    if (error) {
      return res.status(500).json({ success: false, message: "Error fetching papers.", error: error.message });
    }

    const transformedPapers = papers?.map(item => item.research_papers).filter(Boolean) || [];

    return res.status(200).json({
      success: true,
      message: "Papers retrieved successfully.",
      data: { papers: transformedPapers },
    });
  } catch (error) {
    console.error("getAllResearchPapersController error:", error);
    return res.status(500).json({ success: false, message: "Server error.", error: error.message });
  }
};

// ==============================
// 7. getResearchPaperByIdController
// ==============================
export const getResearchPaperByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!id) {
      return res.status(400).json({ success: false, message: "Paper ID is required." });
    }

    const { data: paper, error } = await supabase
      .from("research_papers")
      .select(`
        *,
        reviews (id, comments_for_authors, technical_confidence, recommendation),
        paper_authors (
          author_id,
          authors (id, first_name, last_name, email, corresponding_author, affiliation, user_id)
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !paper) {
      return res.status(404).json({ success: false, message: "Paper not found." });
    }

    const isAuthor = paper.paper_authors?.some(pa => pa.authors?.user_id === userId);
    if (!isAuthor) {
      return res.status(403).json({ success: false, message: "You are not an author of this paper." });
    }

    return res.status(200).json({
      success: true,
      message: "Paper retrieved successfully.",
      data: { paper },
    });
  } catch (error) {
    console.error("getResearchPaperByIdController error:", error);
    return res.status(500).json({ success: false, message: "Server error.", error: error.message });
  }
};

// ==============================
// 8. getUserConferencePapersController
// ==============================
export const getUserConferencePapersController = async (req, res) => {
  try {
    const { userId, conferenceId } = req.params;

    if (!userId || !conferenceId) {
      return res.status(400).json({ success: false, message: "User ID and Conference ID are required." });
    }

    const { data: roleCheck } = await supabase
      .from("user_conference_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("conference_id", conferenceId)
      .eq("role", "author")
      .maybeSingle();

    if (!roleCheck) {
      return res.status(403).json({ success: false, message: "You are not registered as an author for this conference." });
    }

    const { data: papers, error } = await supabase
      .from("paper_authors")
      .select(`
        research_papers!inner (
          id,
          title,
          abstract,
          keywords,
          paper_file_path,
          status,
          final_decision,
          created_at,
          conference_id,
          conference_name,
          conference_acronym,
          validation_info,
          resubmission_count,
          reviews (comments_for_authors, technical_confidence),
          organizer_comments_for_authors
        )
      `)
      .eq("authors.user_id", userId)
      .eq("research_papers.conference_id", conferenceId);

    if (error) {
      return res.status(500).json({ success: false, message: "Error fetching papers.", error: error.message });
    }

    const transformedPapers = papers?.map(item => item.research_papers).filter(Boolean) || [];

    return res.status(200).json({
      success: true,
      message: "Papers fetched successfully.",
      data: { papers: transformedPapers },
    });
  } catch (error) {
    console.error("getUserConferencePapersController error:", error);
    return res.status(500).json({ success: false, message: "Server error.", error: error.message });
  }
};