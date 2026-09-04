from __future__ import annotations

from html import escape
from pathlib import Path
from shutil import copy2

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "public"
ID_PHOTO = ROOT.parent / "JOONGWON_CHAE_ID Photo.jpg"

NAVY = colors.HexColor("#17385f")
INK = colors.HexColor("#202124")
MUTED = colors.HexColor("#5f6368")
LINE = colors.HexColor("#c8ccd1")
LINK = colors.HexColor("#184d80")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("CVSerif", r"C:\Windows\Fonts\georgia.ttf"))
    pdfmetrics.registerFont(TTFont("CVSerif-Bold", r"C:\Windows\Fonts\georgiab.ttf"))
    pdfmetrics.registerFont(TTFont("CVSerif-Italic", r"C:\Windows\Fonts\georgiai.ttf"))
    pdfmetrics.registerFont(TTFont("CVSerif-BoldItalic", r"C:\Windows\Fonts\georgiaz.ttf"))
    pdfmetrics.registerFontFamily(
        "CVSerif",
        normal="CVSerif",
        bold="CVSerif-Bold",
        italic="CVSerif-Italic",
        boldItalic="CVSerif-BoldItalic",
    )

    pdfmetrics.registerFont(TTFont("CVCJK", r"C:\Windows\Fonts\msyh.ttc"))
    pdfmetrics.registerFont(TTFont("CVCJK-Bold", r"C:\Windows\Fonts\msyhbd.ttc"))
    pdfmetrics.registerFontFamily(
        "CVCJK",
        normal="CVCJK",
        bold="CVCJK-Bold",
        italic="CVCJK",
        boldItalic="CVCJK-Bold",
    )


PUBLICATIONS = [
    {
        "title": "What Remains Normal? Clean Images Miss Useful Near-Defect Normal Patches for Anomaly Detection",
        "authors": "Joongwon Chae, Runming Wang, Peiwu Qin",
        "venue": "Under review at ICLR; arXiv:2608.23299 [cs.CV], 2026",
        "venue_zh": "ICLR 审稿中；arXiv:2608.23299 [cs.CV]，2026",
        "url": "https://arxiv.org/abs/2608.23299",
        "code": "https://github.com/jw-chae/boundary_support",
    },
    {
        "title": "What Memory Composition Does Not Tell Us About Anomaly Detection",
        "authors": "Joongwon Chae, Runming Wang, Peiwu Qin",
        "venue": "Under review at ICLR; arXiv:2608.23295 [cs.CV], 2026",
        "venue_zh": "ICLR 审稿中；arXiv:2608.23295 [cs.CV]，2026",
        "url": "https://arxiv.org/abs/2608.23295",
        "code": "https://github.com/jw-chae/cleancon",
    },
    {
        "title": "ProCon: Projection-Consistency Memory for Training-Free Anomaly Detection",
        "authors": "Joongwon Chae, Lihui Luo, Yang Liu, Dongmei Yu, Peiwu Qin, Runming Wang, Ilmoon Chae",
        "venue": "Under review; arXiv:2607.04894 [cs.CV], 2026",
        "venue_zh": "审稿中；arXiv:2607.04894 [cs.CV]，2026",
        "url": "https://arxiv.org/abs/2607.04894",
        "code": "https://github.com/jw-chae/Procon",
    },
    {
        "title": "GCR: Geometry-Consistent Routing for Task-Agnostic Continual Anomaly Detection",
        "authors": "Joongwon Chae, Lihui Luo, Yang Liu, Runming Wang, Dongmei Yu, Zeming Liang, Xi Yuan, Dayan Zhang, Zhenglin Chen, Peiwu Qin, Ilmoon Chae",
        "venue": "Under review; arXiv:2601.01856 [cs.CV], 2026",
        "venue_zh": "审稿中；arXiv:2601.01856 [cs.CV]，2026",
        "url": "https://arxiv.org/abs/2601.01856",
        "code": "https://github.com/jw-chae/GCR",
    },
    {
        "title": "StructCore: Structure-Aware Image-Level Scoring for Training-Free Unsupervised Anomaly Detection",
        "authors": "Joongwon Chae, Lihui Luo, Yang Liu, Runming Wang, Dongmei Yu, Zeming Liang, Xi Yuan, Dayan Zhang, Zhenglin Chen, Peiwu Qin, Ilmoon Chae",
        "venue": "Under review at WACV; arXiv:2602.17048 [cs.CV], 2026",
        "venue_zh": "WACV 审稿中；arXiv:2602.17048 [cs.CV]，2026",
        "url": "https://arxiv.org/abs/2602.17048",
        "code": "https://github.com/jw-chae/structcore",
    },
    {
        "title": "Memory-SAM: Human-Prompt-Free Tongue Segmentation via Retrieval-to-Prompt",
        "authors": "Joongwon Chae, Lihui Luo, Yang Liu, Xi Yuan, Dongmei Yu, Zhenglin Chen, Runming Wang, Ilmoon Chae, Lian Zhang, Peiwu Qin",
        "venue": "Under review at AAAI 2027; arXiv:2510.15849 [cs.CV], 2025",
        "venue_zh": "AAAI 2027 审稿中；arXiv:2510.15849 [cs.CV]，2025",
        "url": "https://arxiv.org/abs/2510.15849",
        "code": "https://github.com/jw-chae/memory-sam",
    },
    {
        "title": "MMIR-TCM: Memory-Integrated Multimodal Inference and Retrieval for TCM Clinical Decision Support",
        "authors": "Lihui Luo, Joongwon Chae, Ziyan Chen, Yang Liu, Siyi Cheng, Weihan Gao, Zelin Zeng, Xiaoming Yin, Samaneh Beheshti Kashi, Dongmei Yu, Lian Zhang, Jing Sui, Zeming Liang, Jiansong Ji, Peter E. Lobie, Peiwu Qin",
        "venue": "Major revision at IEEE JBHI; arXiv:2607.01814 [cs.AI], 2026",
        "venue_zh": "IEEE JBHI 大修；arXiv:2607.01814 [cs.AI]，2026",
        "url": "https://arxiv.org/abs/2607.01814",
    },
    {
        "title": "Auditable Context-Aware HFMD Forecasting with Structured LLM Agents",
        "authors": "Joongwon Chae, Runming Wang, Chen Xiong, Gong Yunhan, Lian Zhang, Ji Jiansong, Dongmei Yu, Peiwu Qin",
        "venue": "Under review at IEEE BIBM; arXiv:2511.23276 [cs.LG, cs.MA], 2025",
        "venue_zh": "IEEE BIBM 审稿中；arXiv:2511.23276 [cs.LG, cs.MA]，2025",
        "url": "https://arxiv.org/abs/2511.23276",
    },
    {
        "title": "ViGen: Video-based Generation with GRPO for Dynamic Image Editing",
        "authors": "Lihui Luo*, Joongwon Chae*",
        "venue": "Under review at AAAI, 2026",
        "venue_zh": "AAAI 审稿中，2026",
        "note": "* Co-first author",
        "note_zh": "* 共同第一作者",
    },
]

PEER_REVIEWED = [
    {
        "title": "Pre-operative T-stage discrimination in gallbladder cancer using machine learning and DeepSeek-R1",
        "authors": "Joongwon Chae, Zhenyu Wang, Duanpo Wu, Lian Zhang, Alexander Tuzikov, Magrupov Talat Madiyevich, Min Xu, Dongmei Yu, Peiwu Qin",
        "venue": "Frontiers in Oncology, 15, Article 1613462, 2025",
        "url": "https://doi.org/10.3389/fonc.2025.1613462",
    },
    {
        "title": "ViTCM-LLM: A Multimodal RAG Framework for Advanced TCM Clinical Decision Support",
        "authors": "Lihui Luo*, Joongwon Chae*, Yang Liu, Igor Pantic, Vladan Devedzic, Zhumei Sun, Zelin Zeng, Sanatbek Matlatipov, Xiaoming Yin, Peiwu Qin",
        "venue": "2025 IEEE International Conference on Bioinformatics and Biomedicine (BIBM), pp. 3894-3899",
        "url": "https://doi.org/10.1109/BIBM66473.2025.11357113",
        "code": "https://github.com/jw-chae/ViTCM_LLM",
        "note": "* Equal contribution",
        "note_zh": "* 共同第一作者",
    },
]


def make_styles(font_name: str, bold_name: str, is_zh: bool) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    leading = 10.1 if not is_zh else 10.6
    return {
        "name": ParagraphStyle(
            "Name",
            parent=base["Normal"],
            fontName=bold_name,
            fontSize=22,
            leading=24,
            textColor=INK,
            spaceAfter=2,
        ),
        "tagline": ParagraphStyle(
            "Tagline",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=9.3,
            leading=12,
            textColor=MUTED,
            spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "Contact",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=8.2,
            leading=10.2,
            textColor=INK,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=base["Normal"],
            fontName=bold_name,
            fontSize=10.4,
            leading=12,
            textColor=NAVY,
            spaceBefore=5.2,
            spaceAfter=1.5,
            tracking=0.6 if not is_zh else 0,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=8.45,
            leading=leading,
            textColor=INK,
            spaceAfter=3,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=7.8,
            leading=9.4,
            textColor=MUTED,
            spaceAfter=2,
        ),
        "item": ParagraphStyle(
            "Item",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=8.45,
            leading=leading,
            textColor=INK,
            spaceAfter=1.4,
        ),
        "item_title": ParagraphStyle(
            "ItemTitle",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=8.8,
            leading=10.4,
            textColor=INK,
        ),
        "date": ParagraphStyle(
            "Date",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=8.1,
            leading=10.2,
            alignment=TA_RIGHT,
            textColor=MUTED,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=8.25,
            leading=9.9 if not is_zh else 10.4,
            leftIndent=9,
            firstLineIndent=-6,
            bulletIndent=0,
            textColor=INK,
            spaceAfter=1.7,
        ),
        "pub": ParagraphStyle(
            "Publication",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=8.0,
            leading=9.5 if not is_zh else 10.0,
            leftIndent=11,
            firstLineIndent=-11,
            textColor=INK,
            spaceAfter=3.2,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=7,
            leading=8,
            alignment=TA_RIGHT,
            textColor=MUTED,
        ),
    }


def section(story: list, title: str, styles: dict[str, ParagraphStyle]) -> None:
    story.append(Paragraph(escape(title), styles["section"]))
    story.append(HRFlowable(width="100%", thickness=0.35, color=LINE, spaceBefore=0, spaceAfter=3))


def dated_item(
    story: list,
    title: str,
    date: str,
    detail: str,
    styles: dict[str, ParagraphStyle],
    width: float,
) -> None:
    row = Table(
        [[Paragraph(title, styles["item_title"]), Paragraph(escape(date), styles["date"])]],
        colWidths=[width - 104, 104],
        hAlign="LEFT",
    )
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(KeepTogether([row, Paragraph(detail, styles["small"])]))


def bullet(story: list, text: str, styles: dict[str, ParagraphStyle]) -> None:
    story.append(Paragraph(text, styles["bullet"], bulletText="•"))


def author_markup(authors: str) -> str:
    return escape(authors).replace("Joongwon Chae", "<b>Joongwon Chae</b>")


def publication(story: list, index: int, item: dict[str, str], styles: dict[str, ParagraphStyle], is_zh: bool) -> None:
    links = []
    if item.get("url"):
        links.append(f'<link href="{item["url"]}" color="{LINK.hexval()}">{"链接" if is_zh else "link"}</link>')
    if item.get("code"):
        links.append(f'<link href="{item["code"]}" color="{LINK.hexval()}">{"代码" if is_zh else "code"}</link>')
    note_text = item.get("note_zh", item.get("note", "")) if is_zh else item.get("note", "")
    note = f' <font color="{MUTED.hexval()}">({escape(note_text)})</font>' if note_text else ""
    link_text = f" {' / '.join(links)}" if links else ""
    venue = item.get("venue_zh", item["venue"]) if is_zh else item["venue"]
    text = (
        f"{index}. {author_markup(item['authors'])}. "
        f'&quot;{escape(item["title"])}.&quot; '
        f'<i>{escape(venue)}</i>.{note}{link_text}'
    )
    story.append(Paragraph(text, styles["pub"]))


def header_block(styles: dict[str, ParagraphStyle], is_zh: bool, width: float) -> list:
    role = "硕士研究生 · 免训练异常检测 · 记忆增强推理 · 医疗人工智能" if is_zh else "Master's Student Researcher · Training-Free Anomaly Detection · Memory-Augmented Inference · Medical AI"
    location = "中国深圳" if is_zh else "Shenzhen, China"
    contact = (
        f'<link href="mailto:cai-zy24@mails.tsinghua.edu.cn" color="{LINK.hexval()}">cai-zy24@mails.tsinghua.edu.cn</link>'
        f'  |  GitHub: <link href="https://github.com/jw-chae" color="{LINK.hexval()}">github.com/jw-chae</link>'
        f"  |  {location}"
    )
    left = [
        Paragraph("Joongwon Chae", styles["name"]),
        Paragraph(role, styles["tagline"]),
        Paragraph(contact, styles["contact"]),
    ]
    photo = Image(str(ID_PHOTO), width=26 * mm, height=34.7 * mm)
    table = Table([[left, photo]], colWidths=[width - 82, 82], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 8),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [table, HRFlowable(width="100%", thickness=0.8, color=NAVY, spaceBefore=4, spaceAfter=4)]


def page_number(canvas, doc, styles, is_zh: bool) -> None:
    canvas.saveState()
    label = f"Joongwon Chae · {'第 ' if is_zh else ''}{doc.page}{' 页' if is_zh else ''}"
    paragraph = Paragraph(label, styles["footer"])
    paragraph.wrapOn(canvas, 120, 10)
    paragraph.drawOn(canvas, A4[0] - 48 - 120, 14)
    canvas.restoreState()


def build_english(path: Path) -> None:
    styles = make_styles("CVSerif", "CVSerif-Bold", False)
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=48,
        leftMargin=48,
        topMargin=30,
        bottomMargin=28,
        title="Joongwon Chae - Curriculum Vitae",
        author="Joongwon Chae",
        subject="Academic curriculum vitae",
    )
    width = A4[0] - doc.leftMargin - doc.rightMargin
    story: list = header_block(styles, False, width)

    section(story, "RESEARCH INTERESTS", styles)
    story.append(Paragraph(
        "I develop training-free visual systems around a central question: which reference evidence should a frozen model retain, route, and trust? My work spans memory composition, projection-consistent selection, continual routing, and retrieval-to-prompt segmentation.",
        styles["body"],
    ))

    section(story, "EDUCATION", styles)
    dated_item(
        story,
        "<b>Tsinghua University</b> - Shenzhen International Graduate School (SIGS)",
        "2024-2027 (expected)",
        "M.S. in Electronic Information (Biomedical Engineering), Institute of Biopharmaceutical and Health Engineering · Advisors: Peiwu Qin and Runming Wang · Shenzhen, China",
        styles,
        width,
    )
    dated_item(
        story,
        "<b>Shanghai Jiao Tong University (SJTU)</b> - Department of Automation",
        "2018-2024",
        "B.S. in Automation · Shanghai, China",
        styles,
        width,
    )

    section(story, "RESEARCH EXPERIENCE", styles)
    dated_item(
        story,
        "<b>Master's Student Researcher</b> - Tsinghua University (SIGS)",
        "2024-present",
        "Leading method development under the supervision of Peiwu Qin and Runming Wang.",
        styles,
        width,
    )
    bullet(story, "<b>BoundarySupport.</b> I showed that clean images miss useful near-defect normal states and introduced a clean-only altered-context intervention for fixed-budget memory and reconstruction. Near-defect normal patches raised MVTec P-AP from 73.34 to 76.95, with a two-cell band recovering 94.70% of the gain; P-AP improved in all six settings across three paired seeds.", styles)
    bullet(story, "<b>CLEANCON.</b> I introduced an out-of-bag cross-image support gate that scores each image from the top 0.5% of soft-projection patch residuals while holding the encoder, memory budget, builder, and inference fixed. At a 1% budget, Global FF amplified sparse contamination by 16.04 to 40.61 times; CLEANCON drove memory contamination to approximately zero and improved macro P-AP in all 12 matched comparisons.", styles)
    bullet(story, "<b>ProCon, GCR, and Memory-SAM.</b> I developed soft-projection residuals with bank and depth consensus, 32-patch nearest-prototype routing, and foreground-minus-background DINOv3 contrast that selects three SAM2 prompts. Memory-SAM also releases 2,155 de-identified image-mask pairs; earlier versions averaged 24/28 at ICASSP 2026 and 4.0/5.0 at MICCAI 2026.", styles)

    dated_item(
        story,
        "<b>Clinical ML study - gallbladder-cancer T-staging</b>",
        "2024-2025",
        "First-authored the Frontiers in Oncology study; designed classical ML baselines, SMOTE analysis, AUROC evaluation, and 1,000-sample bootstrap confidence intervals across 232 patients.",
        styles,
        width,
    )
    dated_item(
        story,
        "<b>Multimodal medical-AI systems (TCM)</b> - co-first author",
        "2024",
        "Co-led ViTCM-LLM and MMIR-TCM; co-developed MedTCM, designed the TDEU evaluation metric, and contributed retrieval-augmented reasoning and safety constraints.",
        styles,
        width,
    )

    section(story, "PEER-REVIEWED PUBLICATIONS", styles)
    for index, item in enumerate(PEER_REVIEWED, 1):
        publication(story, index, item, styles, False)

    story.append(PageBreak())
    section(story, "PREPRINTS & MANUSCRIPTS", styles)
    for index, item in enumerate(PUBLICATIONS, 3):
        publication(story, index, item, styles, False)

    section(story, "HONORS & SCHOLARSHIPS", styles)
    for text in [
        "<b>Excellent Student Scholarship, First Class</b> (International Students), Tsinghua University, 2024",
        "<b>Yingcai First-Class Scholarship</b>, Institute of Biopharmaceutical and Health Engineering, Tsinghua University, 2025",
        "<b>Tsinghua University International Graduate Tuition Scholarship</b>, 2025-2026",
        "<b>Shenzhen Universiade International Scholarship Foundation Scholarship</b>, 2026",
    ]:
        bullet(story, text, styles)

    section(story, "INDUSTRY RESEARCH EXPERIENCE", styles)
    dated_item(
        story,
        "<b>Ratel Soft</b> - Research Intern",
        "Jul 2025-present",
        "Developing vision-based anomaly-detection pipelines for collaborative-robot assembly-line inspection; benchmarking frozen foundation-model features and building PyTorch data and evaluation tooling.",
        styles,
        width,
    )

    section(story, "TECHNICAL SKILLS", styles)
    bullet(story, "<b>Programming:</b> Python, PyTorch, scikit-learn, OpenCV", styles)
    bullet(story, "<b>Foundation models:</b> DINOv2/v3, SAM/SAM2, CLIP; Hugging Face Transformers, PEFT/LoRA, LLaMA-Factory", styles)
    bullet(story, "<b>Systems:</b> Docker, DeepSpeed, multi-GPU training, RAG pipelines, industrial machine-vision cameras", styles)

    section(story, "LANGUAGES", styles)
    story.append(Paragraph("Korean (native) · English (IELTS 6.5) · Chinese (HSK 6) · Japanese (JLPT N2)", styles["body"]))

    doc.build(
        story,
        onFirstPage=lambda canvas, current_doc: page_number(canvas, current_doc, styles, False),
        onLaterPages=lambda canvas, current_doc: page_number(canvas, current_doc, styles, False),
    )


def build_chinese(path: Path) -> None:
    styles = make_styles("CVCJK", "CVCJK-Bold", True)
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=48,
        leftMargin=48,
        topMargin=30,
        bottomMargin=28,
        title="Joongwon Chae - 中文简历",
        author="Joongwon Chae",
        subject="学术简历",
    )
    width = A4[0] - doc.leftMargin - doc.rightMargin
    story: list = header_block(styles, True, width)

    section(story, "研究方向", styles)
    story.append(Paragraph(
        "我研究冻结视觉模型应如何保留、路由并使用参考证据。<br/>具体方向包括记忆构成、投影一致性筛选、持续学习路由与检索到提示分割。",
        styles["body"],
    ))

    section(story, "教育经历", styles)
    dated_item(
        story,
        "<b>清华大学深圳国际研究生院</b>",
        "2024-2027（预计）",
        "电子信息硕士（生物医学工程方向），生物医药与健康工程研究院 · 导师：Peiwu Qin、Runming Wang · 中国深圳",
        styles,
        width,
    )
    dated_item(
        story,
        "<b>上海交通大学自动化系</b>",
        "2018-2024",
        "自动化专业学士 · 中国上海",
        styles,
        width,
    )

    section(story, "科研经历", styles)
    dated_item(
        story,
        "<b>硕士研究生</b> - 清华大学深圳国际研究生院",
        "2024年至今",
        "在 Peiwu Qin 与 Runming Wang 指导下主导方法研发。",
        styles,
        width,
    )
    bullet(story, "<b>BoundarySupport：</b>我发现干净图像会遗漏有用的缺陷邻近正常状态，并提出仅使用干净图像的上下文改变方法，服务于固定预算记忆与重建。缺陷邻近正常补丁将 MVTec P-AP 从 73.34 提升至 76.95，其中两个 token 范围内的邻近区域恢复 94.70% 的增益；经过三个配对随机种子，全部六个设置的 P-AP 均得到提升。", styles)
    bullet(story, "<b>CLEANCON：</b>我提出袋外跨图像支持门控，以软投影残差最高的 0.5% 补丁为图像评分依据，同时保持编码器、记忆容量、构建器与推理规则不变。在 1% 预算下，全局最远优先选择将稀疏污染放大 16.04 至 40.61 倍；CLEANCON 将记忆污染率降至近零，并在全部 12 个匹配比较中提升宏平均 P-AP。", styles)
    bullet(story, "<b>ProCon、GCR 与 Memory-SAM：</b>我分别开发带记忆库中位数与层间均值一致性的软投影残差、基于 32 个采样补丁最近原型距离的路由，以及从 DINOv3 前景减背景对比图中选取三个 SAM2 提示点的算法。Memory-SAM 还公开 2,155 对去标识化图像与掩码；此前版本在 ICASSP 2026 与 MICCAI 2026 的平均审稿评分分别为 24/28 和 4.0/5.0。", styles)

    dated_item(
        story,
        "<b>临床机器学习研究 - 胆囊癌术前 T 分期</b>",
        "2024-2025",
        "以第一作者在 Frontiers in Oncology 发表研究；基于 232 名患者设计经典机器学习基线、SMOTE 分析、AUROC 评估及 1,000 次 bootstrap 置信区间。",
        styles,
        width,
    )
    dated_item(
        story,
        "<b>多模态中医药人工智能系统</b> - 共同第一作者",
        "2024",
        "共同主导 ViTCM-LLM 与 MMIR-TCM；共同开发 MedTCM，设计 TDEU 评估指标，并参与检索增强推理与安全约束流程。",
        styles,
        width,
    )

    section(story, "同行评审论文", styles)
    for index, item in enumerate(PEER_REVIEWED, 1):
        publication(story, index, item, styles, True)

    story.append(PageBreak())
    section(story, "预印本与研究稿件", styles)
    for index, item in enumerate(PUBLICATIONS, 3):
        publication(story, index, item, styles, True)

    section(story, "荣誉与奖学金", styles)
    for text in [
        "<b>清华大学国际学生优秀学生奖学金一等奖</b>，2024",
        "<b>清华大学生物医药与健康工程研究院英才一等奖学金</b>，2025",
        "<b>清华大学国际研究生学费奖学金</b>，2025-2026",
        "<b>深圳大运留学基金会奖学金</b>，2026",
    ]:
        bullet(story, text, styles)

    section(story, "产业科研经历", styles)
    dated_item(
        story,
        "<b>Ratel Soft</b> - 研究实习生",
        "2025年7月至今",
        "开发面向协作机器人装配线检测的视觉异常检测流程；对比冻结基础模型特征与任务专用基线，并使用 PyTorch 构建数据与评估工具。",
        styles,
        width,
    )

    section(story, "技术技能", styles)
    bullet(story, "<b>编程与框架：</b>Python、PyTorch、scikit-learn、OpenCV", styles)
    bullet(story, "<b>基础模型：</b>DINOv2/v3、SAM/SAM2、CLIP；Hugging Face Transformers、PEFT/LoRA、LLaMA-Factory", styles)
    bullet(story, "<b>系统与工程：</b>Docker、DeepSpeed、多 GPU 训练、RAG 流程、工业机器视觉相机", styles)

    section(story, "语言能力", styles)
    story.append(Paragraph("韩语（母语） · 英语（IELTS 6.5） · 中文（HSK 6） · 日语（JLPT N2）", styles["body"]))

    doc.build(
        story,
        onFirstPage=lambda canvas, current_doc: page_number(canvas, current_doc, styles, True),
        onLaterPages=lambda canvas, current_doc: page_number(canvas, current_doc, styles, True),
    )


def main() -> None:
    register_fonts()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    english = OUTPUT_DIR / "JoongwonChae_CV_EN.pdf"
    chinese = OUTPUT_DIR / "JoongwonChae_CV_ZH.pdf"
    build_english(english)
    build_chinese(chinese)
    copy2(english, PUBLIC_DIR / "JoongwonChae_CV_EN.pdf")
    copy2(english, PUBLIC_DIR / "JoongwonChae_CV.pdf")
    copy2(chinese, PUBLIC_DIR / "JoongwonChae_CV_ZH.pdf")

    print(english)
    print(chinese)


if __name__ == "__main__":
    main()
