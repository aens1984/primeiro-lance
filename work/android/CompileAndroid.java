import javax.tools.*;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Stock JDK compiler API; the short-lived process owns the SDK archive handles. */
public final class CompileAndroid {
    public static void main(String[] args) {
        if(args.length<4) throw new IllegalArgumentException("SDK, lambda stubs, destination and sources required");
        JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
        if(compiler==null) throw new IllegalStateException("A JDK is required");
        StandardJavaFileManager files=compiler.getStandardFileManager(null,Locale.ROOT,StandardCharsets.UTF_8);
        List<String> sources=Arrays.asList(Arrays.copyOfRange(args,3,args.length));
        List<String> options=Arrays.asList("-encoding","UTF-8","-source","8","-target","8","-Xlint:-options","-bootclasspath",args[0]+File.pathSeparator+args[1],"-d",args[2]);
        boolean success=Boolean.TRUE.equals(compiler.getTask(null,files,null,options,null,files.getJavaFileObjectsFromStrings(sources)).call());
        // JDK 21's zipfs close asks Windows to canonicalize a mounted archive,
        // which fails in some restricted file systems despite successful reads.
        // Retain this caller-owned manager until process exit; Windows releases
        // all archive handles when this dedicated compilation process terminates.
        System.exit(success?0:1);
    }
}
