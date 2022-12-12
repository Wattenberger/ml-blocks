import { FileBlockProps, getLanguageFromFilename } from "@githubnext/blocks";
import { Button, Box, FormControl, TextInput, Label, Text, Spinner, Link, Textarea } from "@primer/react";
import { useEffect, useMemo, useState } from "react";
import { Grid } from '@githubocto/flat-ui';
import ReactJson from "react-json-view";
import type { InteractionProps } from "react-json-view";

const API_TOKEN = "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"
export default function (props: FileBlockProps) {
  const { context, content, onRequestGitHubData } = props;
  const [output, setOutput] = useState(null);
  const [inputValues, setInputValues] = useState({});
  const [articleTexts, setArticleTexts] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const parsedContent = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch (e) {
      return {};
    }
  }, [content]);

  const model = parsedContent.model || "runwayml/stable-diffusion-v1-5"
  const inputs = parsedContent.inputs || [{ type: "text", id: "prompt", name: "text prompt", placeholder: "A dog in a hot dog costume" }]
  const outputType = parsedContent.outputType || "image"

  useMemo(() => {
    setInputValues(
      inputs.reduce((arr, value) => {
        arr[value.id] = value.default || ""
        return arr
      }, {})
    )
  }, [parsedContent])

  const outputValue = useMemo(() => {
    if (!["table"].includes(outputType)) return null
    try {
      eval(`window.output = ${output}`)
      return window.output
    } catch (e) {
      console.error(e)
      return null
    }
  }, [output, outputType])

  const getArticleContent = async (url: string) => {
    const body = await fetch(url)
    const text = await body.text()
    const dom = new DOMParser().parseFromString(text, "text/html")
    const article = dom.querySelector("article")
    if (!article) return ""
    const paragraphs = article.getElementsByTagName("p")
    const content = Array.from(paragraphs).map(p => p.textContent).join("\n")
    return content
  }

  useEffect(() => {
    const articleIds = inputs.filter(i => i.type === "article-extraction").map(i => i.id)
    for (const id of articleIds) {
      const url = inputValues[id]
      if (!url) return
      setArticleTexts(v => ({ ...v, [id]: "Loading..." }))
      getArticleContent(url).then(content => {
        setArticleTexts(v => ({ ...v, [id]: content }))
      })
    }
  }, [inputValues])


  const onRun = async (e) => {
    e.preventDefault();
    setIsLoading(true)
    console.log("running", inputValues)
    const values = {
      inputs: inputValues["inputs"],
    }
    if (inputs.find(i => i.id === "inputs" && i.type === "article-extraction")) {
      values.inputs = articleTexts["inputs"]
    }
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(values)
    })
    const type = res.headers.get("content-type");
    if (type && type.indexOf("application/json") !== -1) {
      const json = await res.json();
      if (json.error && json.estimated_time) {
        // wait for the model to be ready
        setTimeout(() => {
          onRun(e)
        }, json.estimated_time * 1000)
        return
      }
      setOutput(json)
      setIsLoading(false)
    } else if (type && type.indexOf("image") !== -1) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setOutput(url)
      setIsLoading(false)
    }
  }


  return (
    <Box display="flex" flexDirection="row" height="100%">
      <Box flex="1" height="100%" overflow="auto" p={6}>
        <h3 style={{ marginBottom: "0.5em" }}>Models</h3>
        <Box display="flex" flexDirection="row" alignItems="center" mb={3}>
          <Link href={`https://huggingface.co/${model}`} target="_blank">
            {model}</Link>
        </Box>
        {parsedContent?.description && (
          <p style={{ marginBottom: "1em" }}>{parsedContent.description}</p>
        )}
        <h3 style={{ marginTop: "3em", marginBottom: "0.6em" }}>Inputs</h3>
        <form onSubmit={onRun} style={{ paddingBottom: "10eme" }}>
          {inputs.map((input, i) => (
            <FormControl key={i} sx={{ mb: 3 }}>
              <FormControl.Label htmlFor={input.name}>{input.name}</FormControl.Label>
              {input.type === "text" ? (
                <TextInput
                  id={input.name}
                  name={input.name}
                  placeholder={input.placeholder}
                  value={inputValues[input.id] || ""}
                  onChange={e => {
                    setInputValues(v => ({ ...v, [input.id]: e.target.value }))
                  }}
                />
              ) : input.type === "textarea" ? (
                <Textarea
                  id={input.name}
                  name={input.name}
                  placeholder={input.placeholder}
                  value={inputValues[input.id] || ""}
                  onChange={e => {
                    setInputValues(v => ({ ...v, [input.id]: e.target.value }))
                  }}
                />
              ) : input.type === "article-extraction" ? (
                <>
                  <TextInput
                    id={input.name}
                    name={input.name}
                    placeholder={input.placeholder}
                    value={inputValues[input.id] || ""}
                    onChange={e => {
                      setInputValues(v => ({ ...v, [input.id]: e.target.value }))
                    }}
                  />
                  <p style={{
                    fontSize: "0.7em",
                    height: "10em",
                    overflow: "auto",
                    marginTop: "1em",
                    color: "#666"
                  }}>{articleTexts[input.id] || ""}</p>
                </>
              ) : input.type === "number" ? (
                <TextInput type="number" id={input.name} name={input.name} placeholder={input.placeholder} value={inputValues[input.id] || 0} onChange={e => {
                  setInputValues(v => ({ ...v, [input.id]: e.target.value }))
                }} />
              ) : input.type === "range" ? (
                <Box display="flex" flexDirection="row" alignItems="center">
                  <Box flex="1">
                    <input
                      type="range"
                      id={input.name}
                      name={input.name}
                      placeholder={input.placeholder}
                      value={inputValues[input.id] || 0}
                      min={input.min || 0}
                      max={input.max || 1}
                      step={input.step || 1}
                      style={{ width: "100%" }}
                      onChange={e => {
                        setInputValues(v => ({ ...v, [input.id]: e.target.value }))
                      }} />
                  </Box>
                  <Box flex="0.4" ml={3}>
                    <TextInput type="number" id={input.name} name={input.name} placeholder={input.placeholder} value={inputValues[input.id] || 0} onChange={e => {
                      setInputValues(v => ({ ...v, [input.id]: e.target.value }))
                    }} />
                  </Box>
                </Box>
              ) : null}
            </FormControl>
          ))}
          <Button type="submit" style={{ marginTop: "1em" }} variant="primary" size="large">
            Run
          </Button>
        </form>
      </Box>
      <Box flex="1.5" p={6} height="100%" overflow="auto">
        <h3 style={{ marginBottom: "0.5em" }}>Result</h3>
        {isLoading ? (
          <Box width="100%" height="100%" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
            <Spinner />
            <Text fontStyle="italic" color="gray.5" textAlign="center" p={3}>
              Loading...
            </Text>
          </Box>
        ) : (
          output === null ? null :
            outputType === "image" ? (
              <img src={output} style={{ width: "100%" }} />
            ) : outputType === "table" ? (
              <Box width="100%" height="90%">
                <Grid
                  data={output[0]}
                  defaultSort={[Object.keys(output[0]?.[0] || {})?.[1], "desc"]}
                />
              </Box>
            ) : outputType === "json" ? (
              <ReactJson
                src={output}
                name={false}
                displayDataTypes={false}
                collapsed={2}
                theme={jsonTheme}
                iconStyle="circle"
                quotesOnKeys={false}
                style={{
                  fontSize: "1em",
                  lineHeight: "1.2em",
                  padding: "2em",
                  fontFamily:
                    "ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "#333",
                }}
              />
            ) : outputType === "text-completion" ? (
              <div style={{ whiteSpace: "pre-wrap", fontSize: "1.1em" }}>
                <span style={{ color: "skyblue" }}>
                  {inputValues["inputs"] || ""}
                </span> {output?.[0]?.generated_text || output}
              </div>
            ) : outputType === "text-generation" ? (
              <div style={{ whiteSpace: "pre-wrap", fontSize: "1.1em" }}>
                {output?.[0]?.generated_text || output}
              </div>
            ) : outputType === "text-summary" ? (
              <div style={{ whiteSpace: "pre-wrap", fontSize: "1.1em" }}>
                {output?.[0]?.summary_text || output}
              </div>
            ) : (
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "1.1em" }}>{JSON.stringify(output, null, 2)}</pre>
            )
        )}
      </Box>
    </Box>
  );
}


const jsonTheme = {
  base00: "white",
  base01: "#cbd5e1",
  base02: "#e2e8f0",
  base03: "#475569",
  base04: "#d1d5db",
  base05: "#475569",
  base06: "#475569",
  base07: "#475569",
  base08: "#14b8a6",
  base09: "#6366f1",
  base0A: "#a855f7",
  base0B: "#db2777",
  base0C: "#ea580c",
  base0D: "#64748b",
  base0E: "#0891b2",
  base0F: "#0d9488",
};
