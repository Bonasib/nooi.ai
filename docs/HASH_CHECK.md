# Known abuse images: a hash check (design only — the owner decides)

Status: **not built, nothing bought.** v126 added the model check (Claude Haiku 5.5 looks at the words and pictures of
every job before it is charged, `lib/safety126.js`). This note is the design for the second layer the brief asks for:
matching uploaded pictures against lists of **known** child sexual abuse material (CSAM) kept by child-safety
organisations. It is a decision for the owner because it needs an application or a contract, and it brings legal duties.

## What a hash check does, and what it doesn't
- Each known abuse image has a fingerprint (a "perceptual hash") that still matches after the picture is resized or
  re-saved. The service compares the fingerprint of each upload with its list and answers "match" or "no match".
- It only finds pictures that are **already known**. New pictures — including anything an AI makes — are not on any list.
  That part is the model check's job (v126). The two work together: the hash check is exact for known material, the model
  check covers new material and words in every language.

## The options
| | Microsoft PhotoDNA Cloud Service | Thorn Safer (Safer Match, Safer Predict) |
|---|---|---|
| What | Hash matching against known CSAM | Hash matching against hashes verified by NCMEC and other NGOs (Match); a classifier for new material and grooming text (Predict) |
| Cost | Free for organisations Microsoft approves | Not published — ask Thorn, or Hive, which offers Safer through its cloud APIs |
| How to get it | An online application; approved case by case by a third party | A sales contract |
| Limits | Only to stop the spread of CSAM and support investigations; Microsoft may send NCMEC aggregate reports that name the customer | Per contract |

Suggested order: **apply for PhotoDNA first** (free). Look at Safer if the application is refused, or if the owner also
wants Safer Predict for new material.

## Where it would sit in nooi
1. **`POST /v1/uploads`** — every uploaded picture, and 2–3 frames of every uploaded video (the frames are taken the same
   way as in `lib/safety126.js`), is checked before the file is kept or used. This is the one place every customer picture
   passes through.
2. Pictures given as links (`https://…` inputs) are checked when a job uses them (the same spot as the v126 check in
   `createJob`).
3. Results made by the engines are not worth hash-checking (they are new pictures). The model check covers them.
4. A small module (for example `lib/hashcheck.js`) with one function, `hashCheck(file) → {match, ref}`, behind an Admin switch, so
   the provider can be changed without touching the rest.

## What happens on a match
- The upload is refused with a plain message ("This file can't be used."), without saying why, and nothing is charged.
- The file and the account details are **kept, locked, and not shown** — a legal hold. That overrides "Delete my account"
  (v125) and the usual clean-ups for that account.
- The account is suspended, and the owner gets an alert.
- **Reporting:** many countries require providers to report CSAM they find (in the United States, providers report to
  NCMEC's CyberTipline). Where nooi's company is registered, and where its customers are, decides what applies. **The owner
  should confirm the duty with a lawyer before switching this on.**
- Staff never open the file. The match record (time, account, the service's reference) is what the report uses.

## What it costs to build
- About 1–2 days of work once the owner has an account: the module, the upload hook, the legal-hold flag, the Admin switch
  and alert, and a test with the provider's test hashes (no real material is ever used in tests).
- Running cost: PhotoDNA is free if approved; Safer is quoted. Each upload waits for one more call (usually well under a
  second).

## The owner's decisions
1. Apply for PhotoDNA (free)? Or ask Thorn/Hive for a Safer quote?
2. Confirm the reporting duty and who files the reports (with a lawyer).
3. Hash-check video uploads (a few frames each), or pictures only?

Sources: [PhotoDNA Cloud Service](https://www.microsoft.com/en-us/photodna/cloudservice) ·
[PhotoDNA FAQ](https://www.microsoft.com/en-us/photodna/faq) ·
[PhotoDNA terms of use](https://www.microsoft.com/en-us/photodna/termsofuse) ·
[Thorn: Safer Predict](https://www.thorn.org/blog/introducing-safer-predict-using-the-power-of-ai-to-detect-child-sexual-abuse-and-exploitation-online) ·
[Business Wire: Thorn and Hive](https://www.businesswire.com/news/home/20241121711311/en) ·
[Thorn: Safer impact report 2026](https://www.thorn.org/blog/safer-impact-report-2026/)
