package br.com.primeirolance.treinador;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.util.concurrent.*;
import java.util.regex.*;

/** One native UCI process, one search at a time. No shell or network service. */
public final class StockfishEngine {
    private final String executable;
    private Process process;
    private BufferedWriter input;
    private BlockingQueue<String> lines;
    private String name = "Stockfish";
    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor();
    private static final Pattern SCORE = Pattern.compile("\\bscore (cp|mate) (-?\\d+)");
    private static final Pattern DEPTH = Pattern.compile("\\bdepth (\\d+)");
    private static final Pattern PV = Pattern.compile("\\bpv (.+)$");

    public StockfishEngine(String executable) { this.executable = executable; }

    private void send(String command) throws IOException {
        input.write(command); input.newLine(); input.flush();
    }

    private String next(long deadline) throws Exception {
        String line = lines.poll(Math.max(1, deadline - System.currentTimeMillis()), TimeUnit.MILLISECONDS);
        if (line == null || line.equals("__EXIT__")) throw new IOException("O Stockfish não respondeu. Feche e abra o aplicativo.");
        if (line.startsWith("id name ")) name = line.substring(8);
        return line;
    }

    private void waitFor(String marker, long timeout) throws Exception {
        long deadline = System.currentTimeMillis() + timeout;
        while (!next(deadline).equals(marker)) { }
    }

    private void init() throws Exception {
        if (process != null && process.isAlive()) return;
        lines = new LinkedBlockingQueue<>(4096);
        final BlockingQueue<String> output = lines;
        process = new ProcessBuilder(executable).redirectErrorStream(true).start();
        final Process current = process;
        input = new BufferedWriter(new OutputStreamWriter(current.getOutputStream(), "UTF-8"));
        Thread reader = new Thread(() -> {
            try (BufferedReader stream = new BufferedReader(new InputStreamReader(current.getInputStream(), "UTF-8"))) {
                String line;
                while ((line = stream.readLine()) != null) {
                    if (!output.offer(line)) { current.destroy(); break; }
                }
            } catch (IOException ignored) { }
            finally { output.offer("__EXIT__"); }
        }, "Stockfish-output");
        reader.setDaemon(true); reader.start();
        send("uci"); waitFor("uciok", 20000);
        send("setoption name Threads value 1");
        send("setoption name Hash value 32");
        send("isready"); waitFor("readyok", 10000);
    }

    public synchronized JSONObject info() throws Exception {
        try { init(); return new JSONObject().put("engine", name); }
        catch (Exception e) { stop(); throw e; }
    }

    public synchronized JSONObject analyse(JSONObject data) throws Exception {
        String fen = data.getString("fen");
        if (fen.length() > 120 || !fen.matches("[prnbqkPRNBQK1-8/]+ [wb] (?:-|[KQkq]{1,4}) (?:-|[a-h][36]) \\d{1,6} \\d{1,6}"))
            throw new IOException("Posição inválida.");
        JSONArray moves = data.optJSONArray("moves");
        StringBuilder position = new StringBuilder("position fen ").append(fen);
        if (moves != null && moves.length() > 0) {
            if (moves.length() > 4000) throw new IOException("Partida muito longa.");
            position.append(" moves");
            for (int i=0; i<moves.length(); i++) {
                String move = moves.getString(i);
                if (!move.matches("[a-h][1-8][a-h][1-8][qrbn]?")) throw new IOException("Lance inválido.");
                position.append(' ').append(move);
            }
        }
        ScheduledFuture<?> killer = null;
        try {
            init();
            boolean play = data.optString("purpose").equals("play");
            int level = data.optInt("level", 2);
            int elo = play ? (level==4 ? 2000 : level==5 ? 2200 : level==6 ? 2500 : 0) : 0;
            int skill = play && elo==0 ? (level<=1 ? 0 : level==2 ? 3 : 8) : 20;
            send("setoption name UCI_LimitStrength value " + (elo>0 ? "true" : "false"));
            if (elo>0) send("setoption name UCI_Elo value " + elo);
            send("setoption name Skill Level value " + skill);
            send("setoption name MultiPV value 1");
            send("setoption name Clear Hash");
            send("isready"); waitFor("readyok", 5000);
            send(position.toString());
            int ms = Math.max(200, Math.min(3000, data.optInt("ms", 1000)));
            final Process searched = process;
            killer = watchdog.schedule(() -> searched.destroy(), ms+8000L, TimeUnit.MILLISECONDS);
            send("go movetime " + ms);
            JSONObject result = new JSONObject().put("engine", name).put("configuredElo", elo>0 ? elo : JSONObject.NULL);
            long deadline = System.currentTimeMillis()+ms+8000;
            while (true) {
                String line = next(deadline);
                Matcher score = SCORE.matcher(line);
                if (line.startsWith("info ") && score.find() && !line.contains("lowerbound") && !line.contains("upperbound")) {
                    result.put("score", new JSONObject().put("type", score.group(1)).put("value", Integer.parseInt(score.group(2))));
                    Matcher depth = DEPTH.matcher(line), pv = PV.matcher(line);
                    result.put("depth", depth.find() ? Integer.parseInt(depth.group(1)) : 0);
                    result.put("pv", pv.find() ? pv.group(1) : "");
                }
                if (line.startsWith("bestmove ")) {
                    String move = line.split(" ")[1];
                    if (!move.matches("[a-h][1-8][a-h][1-8][qrbn]?")) throw new IOException("O motor não encontrou um lance legal.");
                    JSONObject parsed = new JSONObject().put("from", move.substring(0,2)).put("to", move.substring(2,4));
                    if (move.length()==5) parsed.put("promotion", move.substring(4));
                    return result.put("move", parsed);
                }
            }
        } catch (Exception e) { stop(); throw e; }
        finally { if (killer!=null) killer.cancel(false); }
    }

    public synchronized void stop() {
        if (process!=null) process.destroy();
        process=null; input=null;
    }

    public synchronized void close() { stop(); watchdog.shutdownNow(); }
}
